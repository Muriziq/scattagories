import { Request, Response, NextFunction } from "express";
import { verifyAccessToken as verifyJwt, UserPayload } from "../utils/jwt";

// Extends Express Request to include authenticated user payload
export interface AuthRequest extends Request {
  user?: UserPayload;
}

// Middleware that validates Bearer JWT access tokens; returns status 439 on missing or expired tokens to trigger client refresh
export const verifyAccessToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string;
    const token = (authHeader && authHeader.split(" ")[1]) || req.body?.accessToken;

    if (!token) {
      return res.status(439).json({ code: "TOKEN_EXPIRED", message: "Authentication required" });
    }

    const decoded = verifyJwt<UserPayload>(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(439).json({ code: "TOKEN_EXPIRED", message: "Invalid or expired access token" });
  }
};