import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import pool from "../db";
import dotenv from "dotenv";

dotenv.config();

const router = Router();

router.get("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token found" });
    }

    // 1. Synchronously verify token
    let decoded: { id: string };
    try {
      decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!) as { id: string };
    } catch (jwtErr) {
      return res.status(401).json({ message: "Invalid or expired refresh token" });
    }

    const { id } = decoded;

    // 2. Fetch user from DB
    const checkQuery = `
      SELECT id, username, email, is_email_verified, refresh_token
      FROM users
      WHERE id = $1 AND deleted_at IS NULL;
    `;
    const checkResult = await pool.query(checkQuery, [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ message: "User not found or account deactivated" });
    }

    const user = checkResult.rows[0];
    const userRefreshToken: string[] = Array.isArray(user.refresh_token) ? user.refresh_token : [];

    // 3. Verify token exists in user's active session array
    if (!userRefreshToken.includes(refreshToken)) {
      return res.status(401).json({ message: "Invalid or reuse of refresh token detected" });
    }

    // 4. Generate new Access and Refresh Tokens (Token Rotation)
    const { refresh_token, ...userPayload } = user;

    const newAccessToken = jwt.sign(userPayload, process.env.ACCESS_TOKEN!, {
      expiresIn: "15m",
    });

    const newRefreshToken = jwt.sign({ id }, process.env.REFRESH_TOKEN!, {
      expiresIn: "7d",
    });

    // 5. Replace old refresh token with new refresh token in DB
    const validExistingTokens = userRefreshToken.filter((token) => token !== refreshToken);
    const updatedTokens = [...validExistingTokens, newRefreshToken];

    const updateRefreshQuery = `
      UPDATE users SET refresh_token = $1
      WHERE id = $2 AND deleted_at IS NULL;
    `;
    const updateRefresh = await pool.query(updateRefreshQuery, [updatedTokens, id]);
    if (updateRefresh.rowCount === 0) {
      return res.status(500).json({ message: "Server error updating tokens during refresh" });
    }

    // 6. Set updated cookie and return access token
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({ accessToken: newAccessToken });
  } catch (err: any) {
    console.error("Refresh token error:", err);
    return res.status(500).json({ message: "Server error refreshing token", error: err.message });
  }
});

export default router;