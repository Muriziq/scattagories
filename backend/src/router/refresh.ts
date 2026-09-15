import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";
import dotenv from "dotenv";
import { verifyAndRotateSession } from "../utils/tokenSession";

dotenv.config();

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    const guestToken = req.cookies?.guestToken;

    if (!refreshToken && !guestToken) {
      return res.status(401).json({ message: "No refresh token found" });
    }

    // 1. Synchronously verify token
    let decoded: { id: string };
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!) as { id: string };
    } catch (jwtErr) {
      if (!guestToken) return res.status(401).json({ message: "Invalid or expired Token" });
      try {
        let guestDecoded = jwt.verify(guestToken, process.env.GUEST_TOKEN!) as Record<string, any>;
        const { exp, iat, ...guestPayload } = guestDecoded;
        const newAccessToken = jwt.sign(guestPayload, process.env.ACCESS_TOKEN!, {
          expiresIn: "15m",
        });
        const newGuestToken = jwt.sign(guestPayload, process.env.GUEST_TOKEN!, {
          expiresIn: "1d",
        });

        res.cookie("guestToken", newGuestToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
          maxAge: 1 * 24 * 60 * 60 * 1000,
        });
        return res.status(200).json({ user: guestPayload, accessToken: newAccessToken, accessTokenDate: Date.now() });
      } catch (guestJwtErr) {
        return res.status(401).json({ message: "Invalid or expired Token" });
      }
    }

    const { id } = decoded;

    // 2. Fetch user from DB
    const checkQuery = `
      SELECT id, username, email, is_email_verified, refresh_tokens
      FROM users
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    const user = checkResult.rows[0];

    // 3. Generate new Refresh Token string to pass to atomic verification & rotation
    const newRefreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN!, {
      expiresIn: "7d",
    });

    // 4. Verify token exists & match device/client info in user's active JSONB session array
    const { updatedSessions, isReuseDetected } = verifyAndRotateSession(
      user.refresh_tokens,
      refreshToken,
      newRefreshToken,
      req,
      7
    );

    if (isReuseDetected) {
      // Clear all active sessions to protect account against token theft or device mismatch
      await pool.query(
        `UPDATE users SET refresh_tokens = '[]'::jsonb WHERE id = $1;`,
        [id]
      );
      res.clearCookie("refreshToken");
      return res.status(401).json({ message: "Security alert: Refresh token reuse or device mismatch detected. Please log in again." });
    }

    // 5. Token & Device verified! Now generate new Access Token
    const { refresh_tokens, ...userPayload } = user;
    const newAccessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN!, {
      expiresIn: "15m",
    });

    // 6. Save rotated JSONB sessions to DB
    const updateRefreshQuery = `
      UPDATE users SET refresh_tokens = $1::jsonb
      WHERE id = $2 AND deleted_at IS NULL
      RETURNING id, username, email, is_email_verified;
    `;
    const updateRefresh = await pool.query(updateRefreshQuery, [
      JSON.stringify(updatedSessions),
      id,
    ]);
    if (updateRefresh.rowCount === 0) {
      return res.status(500).json({ message: "Server error updating tokens during refresh" });
    }

    // 6. Set updated cookie and return access token
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ user: updateRefresh.rows[0], accessToken: newAccessToken, accessTokenDate: Date.now() });
  } catch (err: any) {
    return res.status(500).json({ message: "Server error refreshing token" });
  }
});

export default router;