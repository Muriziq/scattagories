import { Request, Response, NextFunction } from "express";
import { verifyAccessToken as verifyJwt, UserPayload } from "../utils/jwt";

export interface AuthRequest extends Request {
  user?: UserPayload;
}

export const verifyAccessToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = (req.headers["authorization"] || req.headers["Authorization"]) as string;
    const token = (authHeader && authHeader.split(" ")[1]) || req.body?.accessToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = verifyJwt<UserPayload>(token);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};