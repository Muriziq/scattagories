import bcrypt from "bcryptjs";
import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import pool from "../db";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import { verifyAccessToken, type AuthRequest } from "../middleware/tokens";

  const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";


// Rate Limiters
// General rate limiter: 100 requests per 15 minutes


// Strict rate limiter for sensitive actions (login, register, forgot password, send email): 5 requests per 15 minutes
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP, please try again after 15 minutes." },
});



// Validation Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email(),
  password: z.string().min(6).max(20),
});

const loginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(6).max(20),
});

const emailSchema = z.string().email();

const tokenSchema = z.string().min(1, "Token is required");



// Helper: Send Verification Email
async function sendEmail(username: string, email: string, verifyToken: string): Promise<void> {

  const verificationUrl = `${clientUrl}/verify-email?token=${verifyToken}`;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Scattagories" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify your email address",
    html: `
      <h2>Hello ${username}!</h2>
      <p>Welcome to our platform. Please click the link below to verify your account to enjoy the game:</p>
      <a href="${verificationUrl}" style="padding: 10px 20px; background-color: #e20c26; color: white; text-decoration: none; border-radius: 5px;">Verify My Email</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${verificationUrl}</p>
      <p>This link will expire in 15 minutes.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

// 1. REGISTER
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid data", error: result.error });
  }

  const { username, email, password } = result.data;

  try {
    const checkQuery = `
      SELECT id, username, email 
      FROM users 
      WHERE (username = $1 OR email = $2) AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [username, email]);
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: "Username or email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userID = uuidv4()

    const refreshToken = jwt.sign({ id: userID }, process.env.REFRESH_TOKEN!, {
      expiresIn: "7d",
    });
    const insertQuery = `
      INSERT INTO users (id, username, email, password_hash, is_email_verified, refresh_token)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, username, email, is_email_verified;
    `;
    const newUser = await pool.query(insertQuery, [userID, username, email, hashedPassword, false, [refreshToken]]);

    const userAns = newUser.rows[0];

    const accessToken = jwt.sign(userAns, process.env.ACCESS_TOKEN!, {
      expiresIn: "15m",
    });

    const verifyToken = jwt.sign({ id: userAns.id }, process.env.VERIFY_TOKEN!, {
      expiresIn: "15m",
    });

    await sendEmail(userAns.username, userAns.email, verifyToken);

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      user: userAns,
      accessToken,
    });

  } catch (error: any) {
    console.error("Registration error:", error);
    return res.status(500).json({
      message: "Server error during registration",
      error: error.message,
    });
  }
});

// 2. LOGIN
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid data", error: result.error });
  }

  const { identifier, password } = result.data;

  try {
    const checkQuery= `
      SELECT id, username, email, password_hash, is_email_verified, deleted_at,refresh_token
      FROM users 
      WHERE (username = $1 OR email = $2) AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [identifier, identifier]);
    if (checkResult.rows.length === 0) {
      return res.sendStatus(404);
    }
    const userAns = checkResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, userAns.password_hash);
    if (!isPasswordValid) {
      return res.sendStatus(401);
    }

    const refreshToken = jwt.sign({ id: userAns.id }, process.env.REFRESH_TOKEN!, {
      expiresIn: "7d",
    });

    const existingTokens = Array.isArray(userAns.refresh_token) ? userAns.refresh_token : [];
    const updatedTokens = [...existingTokens, refreshToken];

    const updateRefreshQuery = `
      UPDATE users SET refresh_token = $1
      WHERE id = $2 AND deleted_at IS NULL;
    `;
    const updateRefresh = await pool.query(updateRefreshQuery, [updatedTokens, userAns.id]);
    if (updateRefresh.rowCount === 0) {
      return res.status(500).json({ message: "Server error updating tokens during login" });
    }
    const { password_hash, deleted_at, ...others } = userAns;
    const accessToken = jwt.sign(others, process.env.ACCESS_TOKEN!, {
      expiresIn: "15m",
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      user: others,
      accessToken,
    });

  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({
      message: "Server error during login",
      error: error.message,
    });
  }
});

// 3. VERIFY EMAIL
router.post("/verify-email", authLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];
    const rawToken = (authHeader && authHeader.split(" ")[1]) || req.body?.verifyToken || req.query?.verifyToken;

    const tokenResult = tokenSchema.safeParse(rawToken);
    if (!tokenResult.success) {
      return res.status(400).json({ message: "A valid token is required", error: tokenResult.error });
    }

    const token = tokenResult.data;
    const decoded = jwt.verify(token, process.env.VERIFY_TOKEN!) as { id: string };

    const updateQuery = `
      UPDATE users
      SET is_email_verified = TRUE, modified_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const result = await pool.query(updateQuery, [decoded.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error: any) {
    console.error("Email verification error:", error);
    return res.status(401).json({
      message: "Invalid or expired verification token",
      error: error.message,
    });
  }
});

// 4. RESEND VERIFICATION EMAIL
router.post("/sendVerification", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid email address", error: result.error });
    }

    const user = await pool.query(
      `SELECT id, username, email, is_email_verified FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(200).json({ message: "If an account with that email exists, a verification link has been sent." });
    }

    const userAns = user.rows[0];
    if (userAns.is_email_verified) {
      return res.status(400).json({ message: "User email already verified" });
    }

    const verifyToken = jwt.sign({ id: userAns.id }, process.env.VERIFY_TOKEN!, {
      expiresIn: "15m",
    });

    await sendEmail(userAns.username, userAns.email, verifyToken);
    return res.status(200).json({ message: "If an account with that email exists, a verification link has been sent." });
  } catch (err: any) {
    console.error("Send verification error:", err);
    return res.status(500).json({ message: "Server error sending verification email", error: err.message });
  }
});

// 5. SIGNOUT / LOGOUT
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
      });

      try {
        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!) as { id: string };
        const updateQuery = `
          UPDATE users SET refresh_token = array_remove(refresh_token, $1)
          WHERE id = $2 AND deleted_at IS NULL;
        `;
        await pool.query(updateQuery, [refreshToken, decoded.id]);
      } catch (jwtErr) {
        // Token was invalid or expired; cookie cleared regardless
      }
    }

    return res.status(200).json({ message: "Signed out successfully" });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Server error during signout", error: error.message });
  }
});

// 6. SOFT DELETE USER ACCOUNT
router.delete("/delete", verifyAccessToken, async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const softDeleteQuery = `
      UPDATE users 
      SET deleted_at = CURRENT_TIMESTAMP, modified_at = CURRENT_TIMESTAMP, refresh_token = '{}'
      WHERE id = $1 AND deleted_at IS NULL 
      RETURNING id, username, deleted_at;
    `;
    const deleteResult = await pool.query(softDeleteQuery, [req.user.id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found or already deleted" });
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error: any) {
    console.error("Delete account error:", error);
    return res.status(500).json({
      message: "Server error deleting account",
      error: error.message,
    });
  }
});

// 7. FORGOT PASSWORD - REQUEST RESET LINK
const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6).max(20),
});

async function sendResetPasswordEmail(username: string, email: string, resetToken: string): Promise<void> {
  const resetUrl = `${clientUrl}/reset-password?token=${resetToken}`;
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: `"Scattagories" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Reset your password",
    html: `
      <h2>Hello ${username}!</h2>
      <p>We received a request to reset your password. Click the link below to set a new password:</p>
      <a href="${resetUrl}" style="padding: 10px 20px; background-color: #e20c26; color: white; text-decoration: none; border-radius: 5px;">Reset Password</a>
      <p>If the button doesn't work, copy and paste this link into your browser:</p>
      <p>${resetUrl}</p>
      <p>This link will expire in 15 minutes.</p>
      <p>If you didn't request a password reset, please ignore this email.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}

router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid email address", error: result.error });
    }

    const user = await pool.query(
      `SELECT id, username, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
    }

    const userAns = user.rows[0];
    const resetToken = jwt.sign({ id: userAns.id }, process.env.RESET_PASSWORD_TOKEN!, {
      expiresIn: "15m",
    });

    await sendResetPasswordEmail(userAns.username, userAns.email, resetToken);
    return res.status(200).json({ message: "If an account with that email exists, a password reset link has been sent." });
  } catch (err: any) {
    console.error("Forgot password error:", err);
    return res.status(500).json({ message: "Server error sending reset password email", error: err.message });
  }
});

// 8. RESET PASSWORD
router.post("/reset-password", authLimiter, async (req: Request, res: Response) => {
  const parseResult = resetPasswordSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ message: "Invalid data", error: parseResult.error });
  }

  const { token, newPassword } = parseResult.data;

  try {
    const decoded = jwt.verify(token, process.env.RESET_PASSWORD_TOKEN!) as { id: string };
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, refresh_token = '{}', modified_at = CURRENT_TIMESTAMP 
      WHERE id = $2 AND deleted_at IS NULL 
      RETURNING id;
    `;
    const result = await pool.query(updateQuery, [hashedPassword, decoded.id]);

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    return res.status(200).json({ message: "Password reset successfully" });
  } catch (error: any) {
    console.error("Reset password error:", error);
    return res.status(401).json({
      message: "Invalid or expired reset token",
      error: error.message,
    });
  }
});

export default router;
