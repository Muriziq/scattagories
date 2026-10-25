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
import { uploadAvatar } from "../utils/upload";
import fs from "fs";
import path from "path";

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
      RETURNING id, username, email, is_email_verified, avatar_url;
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
      SELECT id, username, email, password_hash, is_email_verified, avatar_url, deleted_at, refresh_tokens
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
      RETURNING id, username, email, is_email_verified, avatar_url;
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

// 11. GET USER PROFILE: Returns core profile details and aggregate career stats in a single unified query
router.get("/profile", verifyAccessToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const profileQuery = `
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        u.is_email_verified, 
        u.avatar_url, 
        u.created_at,
        COUNT(gp.id)::int AS total_games,
        COALESCE(SUM(CASE WHEN gp.is_winner = TRUE THEN 1 ELSE 0 END), 0)::int AS total_wins,
        COALESCE(MAX(gp.score), 0)::int AS high_score,
        COALESCE(AVG(gp.score), 0)::numeric(10, 1) AS average_score
      FROM users u
      LEFT JOIN game_players gp ON gp.user_id = u.id
      WHERE u.id = $1 AND u.deleted_at IS NULL
      GROUP BY u.id;
    `;

    const result = await pool.query(profileQuery, [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const row = result.rows[0];
    const totalGames = row.total_games || 0;
    const totalWins = row.total_wins || 0;
    const winRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

    return res.status(200).json({
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        is_email_verified: row.is_email_verified,
        avatar_url: row.avatar_url,
        created_at: row.created_at,
      },
      stats: {
        totalGames,
        totalWins,
        winRate,
        highScore: row.high_score,
        averageScore: Number(row.average_score) || 0,
      },
    });
  } catch (error) {
    console.error("Fetch profile error:", error);
    return res.status(500).json({ message: "Server error fetching profile" });
  }
});

// Validation schema for paginated match history queries
const matchesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  onlyWins: z.enum(["true", "false"]).optional(),
});

// 12. GET USER MATCH HISTORY: Dedicated paginated endpoint with optional win filtering
router.get("/profile/matches", verifyAccessToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const queryValidation = matchesQuerySchema.safeParse(req.query);
    if (!queryValidation.success) {
      return res.status(400).json({ errors: queryValidation.error.format() });
    }

    const { page, limit, onlyWins } = queryValidation.data;
    const filterByWins = onlyWins === "true";

    // Fetch paginated matches (fetch limit + 1 to determine if there is a next page)
    const offset = (page - 1) * limit;
    const matchesQuery = `
      SELECT 
        gp.game_id,
        g.room_code,
        gp.score,
        gp.rank,
        gp.is_winner,
        g.categories,
        g.total_rounds,
        g.ended_at
      FROM game_players gp
      JOIN games g ON gp.game_id = g.id
      WHERE gp.user_id = $1 ${filterByWins ? "AND gp.is_winner = TRUE" : ""}
      ORDER BY g.ended_at DESC
      LIMIT $2 OFFSET $3;
    `;
    const matchesResult = await pool.query(matchesQuery, [userId, limit + 1, offset]);
    const hasMore = matchesResult.rows.length > limit;
    const matches = hasMore ? matchesResult.rows.slice(0, limit) : matchesResult.rows;

    return res.status(200).json({
      matches,
      pagination: {
        page,
        limit,
        hasMore,
      },
    });
  } catch (error) {
    console.error("Fetch match history error:", error);
    return res.status(500).json({ message: "Server error fetching match history" });
  }
});

// 12. UPLOAD PROFILE AVATAR: Handles local file upload, purges previous avatar, and updates avatar_url
router.post(
  "/profile/avatar",
  verifyAccessToken,
  uploadAvatar.single("avatar"),
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      if (!req.file) {
        return res.status(400).json({ message: "No image file provided" });
      }

      // 1. Retrieve existing avatar to remove older file from disk
      const userQuery = `SELECT avatar_url FROM users WHERE id = $1 AND deleted_at IS NULL;`;
      const userRes = await pool.query(userQuery, [userId]);
      const oldAvatarUrl = userRes.rows[0]?.avatar_url;

      if (oldAvatarUrl && oldAvatarUrl.startsWith("/uploads/avatars/")) {
        const oldFilePath = path.join(process.cwd(), oldAvatarUrl);
        if (fs.existsSync(oldFilePath)) {
          fs.unlink(oldFilePath, (err) => {
            if (err) console.error("Error removing old avatar:", err);
          });
        }
      }

      // 2. Relative static public URL
      const relativeUrl = `/uploads/avatars/${req.file.filename}`;

      // 3. Update database record
      const updateQuery = `
        UPDATE users
        SET avatar_url = $1, modified_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND deleted_at IS NULL
        RETURNING id, username, email, is_email_verified, avatar_url;
      `;
      const updateResult = await pool.query(updateQuery, [relativeUrl, userId]);
      if (updateResult.rows.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      const updatedUser = updateResult.rows[0];
      const newAccessToken = signAccessToken(updatedUser);

      return res.status(200).json({
        message: "Profile avatar updated successfully",
        avatar_url: relativeUrl,
        user: updatedUser,
        accessToken: newAccessToken,
      });
    } catch (error) {
      console.error("Upload avatar error:", error);
      return res.status(500).json({ message: "Server error uploading avatar" });
    }
  }
);

// 14. UPDATE PROFILE DETAILS: Updates username and/or email (requires password to change email)
const updateProfileSchema = z
  .object({
    username: z.string().min(3).max(20).trim().toLowerCase().optional(),
    email: z.string().email().trim().toLowerCase().optional(),
    currentPassword: z.string().optional(),
  })
  .refine(
    (data) => !data.email || (data.email && typeof data.currentPassword === "string" && data.currentPassword.length > 0),
    {
      message: "Current password is required to change your email address.",
      path: ["currentPassword"],
    }
  );

router.patch("/profile", verifyAccessToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: "Unauthorized" });

    const parseResult = updateProfileSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ message: "Invalid data", error: parseResult.error });
    }

    const { username, email, currentPassword } = parseResult.data;
    if (!username && !email) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    // 1. Fetch current user row to verify password and compare existing values
    const userQuery = `
      SELECT id, username, email, password_hash, avatar_url, is_email_verified
      FROM users 
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const userResult = await pool.query(userQuery, [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const currentUser = userResult.rows[0];

    // 2. If email is changing, verify current password
    let isEmailChanging = false;
    if (email && email !== currentUser.email) {
      isEmailChanging = true;
      const isPasswordValid = await bcrypt.compare(currentPassword!, currentUser.password_hash);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Incorrect current password" });
      }
    }

    // 3. Build dynamic SQL update statements
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (username && username !== currentUser.username) {
      updates.push(`username = $${paramIndex++}`);
      values.push(username);
    }

    if (isEmailChanging) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email);
      updates.push(`is_email_verified = FALSE`);
    }

    if (updates.length === 0) {
      return res.status(200).json({
        message: "No changes detected",
        user: {
          id: currentUser.id,
          username: currentUser.username,
          email: currentUser.email,
          is_email_verified: currentUser.is_email_verified,
          avatar_url: currentUser.avatar_url,
        },
      });
    }

    updates.push(`modified_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const updateQuery = `
      UPDATE users
      SET ${updates.join(", ")}
      WHERE id = $${paramIndex} AND deleted_at IS NULL
      RETURNING id, username, email, is_email_verified, avatar_url;
    `;
    const updateResult = await pool.query(updateQuery, values);
    const updatedUser = updateResult.rows[0];

    // 4. If email changed, dispatch verification link to new email address
    if (isEmailChanging) {
      const verifyToken = signVerifyToken({ id: updatedUser.id });
      await sendVerificationEmail(updatedUser.username, updatedUser.email, verifyToken);
    }

    const newAccessToken = signAccessToken(updatedUser);

    return res.status(200).json({
      message: isEmailChanging
        ? "Email updated! Please check your new inbox to verify."
        : "Profile updated successfully",
      user: updatedUser,
      accessToken: newAccessToken,
    });
  } catch (error: any) {
    if (error.code === "23505") {
      if (error.detail?.includes("username")) {
        return res.status(400).json({ message: "Username already taken" });
      }
      if (error.detail?.includes("email")) {
        return res.status(400).json({ message: "Email already in use" });
      }
      return res.status(400).json({ message: "Username or email already in use" });
    }
    console.error("Update profile error:", error);
    return res.status(500).json({ message: "Server error updating profile" });
  }
});

export default router;
