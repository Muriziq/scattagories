import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../db";
import { Request, Response, NextFunction } from "express";

dotenv.config();

// 1. Extend the Express Request type so TypeScript knows about req.user
export interface AuthRequest extends Request {
  user?: {username:string,email?: string, is_email_verified?:boolean};
}

export const verifyTokens = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    // 2. Extract token from standard Authorization header, cookies, or body
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(" ")[1] || req.cookies?.accessToken || req.body?.accessToken || req.cookies?.token;

    // 3. ATTEMPT ONE: Validate the existing Access Token
    if (accessToken) {
      try {
        const decoded = jwt.verify(accessToken, process.env.ACCESS_TOKEN!) as {username:string,email?: string, is_email_verified?:boolean} ;
        req.user = decoded;
        return next(); // Token is valid, proceed to the route!
      } catch (err) {
        // Token is expired or invalid. We don't crash; we let it fall through to the refresh logic.
        console.log("Access token invalid/expired, attempting refresh...");
      }
    }

    // 4. ATTEMPT TWO: Validate the Refresh Token
    const refreshToken = req.cookies?.refreshToken || req.cookies?.token;

    if (refreshToken) {
      try {
        const decodedRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN!) as { id: string };
        
        const user = await pool.query(
          `SELECT id, username, email, is_email_verified FROM users WHERE id = $1 AND deleted_at IS NULL`,
          [decodedRefresh.id]
        );

        if (user.rows.length > 0) {
          // Mint a fresh access token for the registered user
          const newAccessToken = jwt.sign(user.rows[0], process.env.ACCESS_TOKEN!, { expiresIn: "15m" });

          // Set the new access token as HTTP-only cookie
          res.cookie("accessToken", newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 15 * 60 * 1000,
          });

          // Attach the new token to the response header so clients can also grab it if needed
          res.setHeader("x-new-access-token", newAccessToken);
          
          req.user = user.rows[0];
          return next(); // Proceed to the route!
        }
      } catch (err) {
        console.log("Refresh token invalid/expired, falling back to Guest.");
      }
    }

    // 5. ATTEMPT THREE: The Guest Fallback
    // If they have no tokens, or both tokens failed/expired, they are a drop-in guest.
    const newID = uuidv4().slice(0, 8);

    
    const guestAccessToken = jwt.sign({username:`Guest_${newID}`}, process.env.ACCESS_TOKEN!, { expiresIn: "1d" });
    
    res.cookie("accessToken", guestAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000,
    });

    // Hand the new guest token back to the frontend
    res.setHeader("x-new-access-token", guestAccessToken);
    
    req.user = {username:`Guest_${newID}`};
    return next(); // Proceed to the route!

  } catch (error) {
    // This only triggers if something goes catastrophically wrong with the server/DB connection
    console.error("Auth Middleware Error:", error);
    return res.status(500).json({ message: "Internal server error during authentication" });
  }
};