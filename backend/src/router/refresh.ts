import express, { Request, Response, Router } from "express";
import pool from "../db";
import dotenv from "dotenv";
import { verifyAndRotateSession } from "../utils/tokenSession";
import {
  verifyRefreshToken,
  verifyGuestToken,
  signAccessToken,
  signRefreshToken,
  signGuestToken,
} from "../utils/jwt";
import {
  setRefreshTokenCookie,
  setGuestTokenCookie,
  clearRefreshTokenCookie,
} from "../utils/cookies";

dotenv.config();
const router = Router();

// GET /refresh: Rotates the refresh token and issues a fresh short-lived access token
router.get("/", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const guestToken = req.cookies?.guestToken;

    if (!refreshToken && !guestToken) {
      return res.status(401).json({ message: "No refresh token found" });
    }

    // 1. Attempt verifying persistent user refresh token
    let decoded: { id: string } | null = null;
    if (refreshToken) {
      try {
        decoded = verifyRefreshToken<{ id: string }>(refreshToken);
      } catch (jwtErr) {
        // Fall back to checking guest token below if user token verification fails
      }
    }

    // 2. Handle guest token refresh if user refresh token is not present or expired
    if (!decoded && guestToken) {
      try {
        const guestDecoded = verifyGuestToken<Record<string, any>>(guestToken);
        const { exp, iat, ...guestPayload } = guestDecoded;
        const newAccessToken = signAccessToken(guestPayload as any);
        const newGuestToken = signGuestToken(guestPayload as any);

        setGuestTokenCookie(res, newGuestToken);
        return res.status(200).json({
          user: guestPayload,
          accessToken: newAccessToken,
        });
      } catch (guestJwtErr) {
        return res.status(401).json({ message: "Invalid or expired Token" });
      }
    }

    if (!decoded) {
      return res.status(401).json({ message: "Invalid or expired Token" });
    }

    const { id } = decoded;

    // 3. Fetch active user record and session list
    const checkQuery = `
      SELECT id, username, email, is_email_verified, avatar_url, refresh_tokens
      FROM users
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    const user = checkResult.rows[0];

    // 4. Generate new rotated refresh token
    const newRefreshToken = signRefreshToken({ id });

    // 5. Validate session against device/platform and rotate stored hash
    const { updatedSessions, isReuseDetected } = verifyAndRotateSession(
      user.refresh_tokens,
      refreshToken,
      newRefreshToken,
      req,
      7
    );

    // If token theft, revoked session, or unauthorized device switch is detected
    if (isReuseDetected) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({
        message: "Session expired or invalid. Please log in again.",
      });
    }

    // 6. Generate fresh access token
    const { refresh_tokens, ...userPayload } = user;
    const newAccessToken = signAccessToken(userPayload);

    // 7. Persist rotated session list to database
    const updateRefreshQuery = `
      UPDATE users SET refresh_tokens = $1::jsonb
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, username, email, is_email_verified, avatar_url;
    `;
    const updateRefresh = await pool.query(updateRefreshQuery, [
      JSON.stringify(updatedSessions),
      id,
    ]);
    if (updateRefresh.rowCount === 0) {
      return res.status(500).json({ message: "Server error updating tokens during refresh" });
    }

    setRefreshTokenCookie(res, newRefreshToken);

    return res.status(200).json({
      user: updateRefresh.rows[0],
      accessToken: newAccessToken,
    });
  } catch (err: any) {
    return res.status(500).json({ message: "Server error refreshing token" });
  }
});

export default router;