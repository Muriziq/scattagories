import bcrypt from "bcryptjs";
import express, { Request, Response } from "express";
import { z } from "zod";
import pool from "../db";
import rateLimit from "express-rate-limit";
import { v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { verifyAccessToken, type AuthRequest } from "../middleware/tokens";
import { createSessionObject, removeSession } from "../utils/tokenSession";
import {
  signAccessToken,
  signRefreshToken,
  signVerifyToken,
  signResetPasswordToken,
  signGuestToken,
  verifyVerifyToken,
  verifyResetPasswordToken,
} from "../utils/jwt";
import {
  setRefreshTokenCookie,
  setGuestTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/cookies";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";

const router = express.Router();

// Strict rate limiter for sensitive actions (login, register, forgot password, send email)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP, please try again after 15 minutes." },
});

// Validation Schemas
const registerSchema = z.object({
  username: z.string().min(3).max(20).trim().toLowerCase(),
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(6).max(20),
});

const loginSchema = z.object({
  identifier: z.string().min(3).trim().toLowerCase(),
  password: z.string().min(6).max(20),
});

const emailSchema = z.string().email().trim().toLowerCase();

const resetPasswordSchema = z.object({
  token: z.string(),
  newPassword: z.string().min(6).max(20),
});

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
    const userID = uuidv4();

    const refreshToken = signRefreshToken({ id: userID });
    const sessionObj = createSessionObject(refreshToken, req, 7);

    const insertQuery = `
      INSERT INTO users (id, username, email, password_hash, is_email_verified, refresh_tokens)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, username, email, is_email_verified;
    `;
    const newUser = await pool.query(insertQuery, [
      userID,
      username,
      email,
      hashedPassword,
      false,
      JSON.stringify([sessionObj]),
    ]);

    const userAns = newUser.rows[0];

    const accessToken = signAccessToken(userAns);
    const verifyToken = signVerifyToken({ id: userAns.id });

    await sendVerificationEmail(userAns.username, userAns.email, verifyToken);
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      user: userAns,
      accessToken,
      accessTokenDate: Date.now(),
    });
  } catch (error: any) {
    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server error: Pls Retry Later" });
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
    const checkQuery = `
      SELECT id, username, email, password_hash, is_email_verified, deleted_at, refresh_tokens
      FROM users 
      WHERE (username = $1 OR email = $2) AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [identifier, identifier]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "Invalid Credentials" });
    }

    const userAns = checkResult.rows[0];
    const isPasswordValid = await bcrypt.compare(password, userAns.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ message: "Invalid Credentials" });
    }

    const refreshToken = signRefreshToken({ id: userAns.id });
    const now = Date.now();
    const existingSessions = Array.isArray(userAns.refresh_tokens) ? userAns.refresh_tokens : [];
    const validSessions = existingSessions.filter(
      (s: any) => typeof s === "object" && s?.expiresAt && s.expiresAt > now
    );
    const newSession = createSessionObject(refreshToken, req, 7);
    const updatedSessions = [...validSessions, newSession];

    const updateRefreshQuery = `
      UPDATE users SET refresh_tokens = $1::jsonb
      WHERE id = $2 AND deleted_at IS NULL;
    `;
    const updateRefresh = await pool.query(updateRefreshQuery, [
      JSON.stringify(updatedSessions),
      userAns.id,
    ]);

    if (updateRefresh.rowCount === 0) {
      return res.status(500).json({ message: "Server error: Pls Retry Later" });
    }

    const { password_hash, deleted_at, refresh_tokens, ...userPayload } = userAns;
    const accessToken = signAccessToken(userPayload);

    setRefreshTokenCookie(res, refreshToken);

    return res.status(200).json({
      user: userPayload,
      accessToken,
      accessTokenDate: Date.now(),
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error: Pls Retry Later" });
  }
});

// 3. VERIFY EMAIL
router.post("/verify-email", authLimiter, async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers["authorization"];
    let token = (authHeader && authHeader.split(" ")[1]) || req.body?.token;

    if (!token || typeof token !== "string" || token.trim() === "") {
      return res.status(400).json({ message: "A valid token is required" });
    }

    const decoded = verifyVerifyToken<{ id: string }>(token);

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
      return res.status(400).json({ message: "Invalid email address" });
    }

    const user = await pool.query(
      `SELECT id, username, email, is_email_verified FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [result.data]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User email doesn't exist" });
    }

    const userAns = user.rows[0];
    if (userAns.is_email_verified) {
      return res.status(400).json({ message: "User email already verified" });
    }

    const verifyToken = signVerifyToken({ id: userAns.id });
    await sendVerificationEmail(userAns.username, userAns.email, verifyToken);

    return res.status(200).json({ message: "Verification link has been sent." });
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
      clearRefreshTokenCookie(res);

      try {
        const decoded = verifyVerifyToken<{ id: string }>(refreshToken);
        const userRes = await pool.query(
          `SELECT id, refresh_tokens FROM users WHERE id = $1 AND deleted_at IS NULL`,
          [decoded.id]
        );
        if (userRes.rows.length > 0) {
          const updatedSessions = removeSession(userRes.rows[0].refresh_tokens, refreshToken);
          await pool.query(
            `UPDATE users SET refresh_tokens = $1::jsonb WHERE id = $2 AND deleted_at IS NULL`,
            [JSON.stringify(updatedSessions), decoded.id]
          );
        }
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
      SET deleted_at = CURRENT_TIMESTAMP, modified_at = CURRENT_TIMESTAMP, refresh_tokens = '[]'::jsonb
      WHERE id = $1 AND deleted_at IS NULL 
      RETURNING id, username, deleted_at;
    `;
    const deleteResult = await pool.query(softDeleteQuery, [req.user.id]);

    if (deleteResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found or already deleted" });
    }

    clearRefreshTokenCookie(res);

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
router.post("/forgot-password", authLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid email address", error: result.error });
    }

    const user = await pool.query(
      `SELECT id, username, email FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [result.data]
    );

    if (user.rows.length === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    const userAns = user.rows[0];
    const resetToken = signResetPasswordToken({ id: userAns.id });

    await sendPasswordResetEmail(userAns.username, userAns.email, resetToken);
    return res.status(200).json({ message: "Check email for reset link." });
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
    const decoded = verifyResetPasswordToken<{ id: string }>(token);
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updateQuery = `
      UPDATE users 
      SET password_hash = $1, refresh_tokens = '[]'::jsonb, modified_at = CURRENT_TIMESTAMP 
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

// 9. GUEST LOGIN
router.get("/guest-login", (req: Request, res: Response) => {
  const randomCode = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  const guestName = `GUEST_${randomCode}`;
  const guestId = uuidv4();
  const userObj = { id: guestId, username: guestName, role: "guest" };

  const guestToken = signGuestToken(userObj);
  const accessToken = signAccessToken(userObj);

  setGuestTokenCookie(res, guestToken);

  return res.status(200).json({
    user: userObj,
    accessToken,
    accessTokenDate: Date.now(),
  });
});

export default router;
