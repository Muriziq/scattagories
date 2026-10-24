import bcrypt from "bcryptjs";
import express, { Request, Response } from "express";
import { z } from "zod";
import pool from "../db";
import rateLimit from "express-rate-limit";
import { v7 as uuidv7 } from "uuid";
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
  verifyRefreshToken,
  verifyResetPasswordToken,
  verifyGuestToken,
} from "../utils/jwt";
import {
  setRefreshTokenCookie,
  setGuestTokenCookie,
  clearRefreshTokenCookie,
  clearGuestTokenCookie,
} from "../utils/cookies";
import { sendVerificationEmail, sendPasswordResetEmail } from "../utils/email";

const router = express.Router();

// Rate limiter for authentication and sensitive operations (15 requests per 15 minutes)
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many attempts from this IP, please try again after 15 minutes." },
});

// Request validation schemas
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

// 1. REGISTER: Creates a new user account with hashed password and sends verification email
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid data", error: result.error });
  }

  const { username, email, password } = result.data;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userID = uuidv7();

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
    });
  } catch (error: any) {
    // Check for PostgreSQL unique constraint violations (code 23505)
    if (error.code === "23505") {
      if (error.constraint?.includes("username") || error.detail?.includes("username")) {
        return res.status(400).json({ message: "Username already exists" });
      }
      if (error.constraint?.includes("email") || error.detail?.includes("email")) {
        return res.status(400).json({ message: "Email already exists" });
      }
      return res.status(400).json({ message: "Username or email already exists" });
    }

    console.error("Registration error:", error);
    return res.status(500).json({ message: "Server error: Pls Retry Later" });
  }
});

// 2. LOGIN: Authenticates user credentials and creates a new refresh token session
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid data", error: result.error });
  }

  const { identifier, password } = result.data;

  try {
    // Query by either username or email, excluding soft-deleted accounts
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

    // Clean up expired sessions and append the new login session
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

    // Strip sensitive fields before returning user data
    const { password_hash, deleted_at, refresh_tokens, ...userPayload } = userAns;
    const accessToken = signAccessToken(userPayload);

    setRefreshTokenCookie(res, refreshToken);

    return res.status(200).json({
      user: userPayload,
      accessToken,
    });
  } catch (error: any) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Server error: Pls Retry Later" });
  }
});

// 3. VERIFY EMAIL: Validates verification token and marks account as verified
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

    // Ensure the targeted user exists and is not soft-deleted
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    return res.status(200).json({ message: "Email verified successfully" });
  } catch (error: any) {
    console.error("Email verification error:", error);
    return res.status(401).json({
      message: "Invalid or expired verification token",
    });
  }
});

// 4. RESEND VERIFICATION EMAIL: Generates and sends a new verification link
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
    // Prevent sending verification link if account is already verified
    if (userAns.is_email_verified) {
      return res.status(400).json({ message: "User email already verified" });
    }

    const verifyToken = signVerifyToken({ id: userAns.id });
    await sendVerificationEmail(userAns.username, userAns.email, verifyToken);

    return res.status(200).json({ message: "Verification link has been sent." });
  } catch (err: any) {
    console.error("Send verification error:", err);
    return res.status(500).json({ message: "Server error sending verification email" });
  }
});

// 5. SIGNOUT / LOGOUT: Clears auth cookies and revokes all active refresh sessions
router.post("/logout", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    clearRefreshTokenCookie(res);
    clearGuestTokenCookie(res);

    // If a valid refresh token exists, clear sessions in the database
    if (refreshToken) {
      try {
        const decoded = verifyRefreshToken<{ id: string }>(refreshToken);
        if (decoded?.id) {
          await pool.query(
            `UPDATE users SET refresh_tokens = '[]'::jsonb WHERE id = $1 AND deleted_at IS NULL;`,
            [decoded.id]
          );
        }
      } catch (jwtErr) {
        // Token was invalid or expired; cookies already cleared
      }
    }

    return res.status(200).json({ message: "Signed out successfully" });
  } catch (error: any) {
    console.error("Logout error:", error);
    return res.status(500).json({ message: "Server error during signout" });
  }
});

// 6. SOFT DELETE USER ACCOUNT: Marks user as deleted and revokes active sessions
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
      message: "Server error deleting account. Please try again later.",
    });
  }
});

// 7. FORGOT PASSWORD: Sends password reset link to registered email
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
    return res.status(500).json({ message: "Server error sending reset password email" });
  }
});

// 8. RESET PASSWORD: Validates reset token, updates password, and revokes existing sessions
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
    });
  }
});

// 9. GUEST LOGIN: Issues a temporary guest session without database registration
router.get("/guest-login", (req: Request, res: Response) => {
  const randomCode = crypto.randomBytes(3).toString("hex").toUpperCase().slice(0, 5);
  const guestName = `GUEST_${randomCode}`;
  const guestId = uuidv7();
  const userObj = { id: guestId, username: guestName, role: "guest" };

  const guestToken = signGuestToken(userObj);
  const accessToken = signAccessToken(userObj);

  setGuestTokenCookie(res, guestToken);

  return res.status(200).json({
    user: userObj,
    accessToken,
  });
});

// 10. CONVERT GUEST ACCOUNT TO PERMANENT USER: Converts guest ID into a full database user
router.post("/convert-guest", authLimiter, async (req: Request, res: Response) => {
  const result = registerSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ message: "Invalid data", error: result.error });
  }

  const guestToken = req.cookies?.guestToken;
  if (!guestToken) {
    return res.status(400).json({ message: "No active guest session found to convert." });
  }

  // Validate guest token and retrieve the original guest ID to preserve game records
  let guestId: string;
  try {
    const decoded = verifyGuestToken<{ id: string; role?: string }>(guestToken);
    guestId = decoded.id;
  } catch (err) {
    clearGuestTokenCookie(res);
    return res.status(401).json({ message: "Guest session has expired or is invalid." });
  }

  const { username, email, password } = result.data;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const refreshToken = signRefreshToken({ id: guestId });
    const sessionObj = createSessionObject(refreshToken, req, 7);

    // Reuse existing guestId so past match results and statistics are maintained
    const insertQuery = `
      INSERT INTO users (id, username, email, password_hash, is_email_verified, refresh_tokens)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING id, username, email, is_email_verified;
    `;
    const newUser = await pool.query(insertQuery, [
      guestId,
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

    // Transition from guest cookie to persistent user refresh token
    clearGuestTokenCookie(res);
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      message: "Guest account converted successfully! Please verify your email.",
      user: userAns,
      accessToken,
    });
  } catch (error: any) {
    // Check for PostgreSQL unique constraint violations (code 23505)
    if (error.code === "23505") {
      if (error.constraint?.includes("username") || error.detail?.includes("username")) {
        return res.status(400).json({ message: "Username already exists" });
      }
      if (error.constraint?.includes("email") || error.detail?.includes("email")) {
        return res.status(400).json({ message: "Email already exists" });
      }
      return res.status(400).json({ message: "Username or email already exists" });
    }

    console.error("Convert guest error:", error);
    return res.status(500).json({ message: "Server error converting account. Please try again later." });
  }
});

export default router;
