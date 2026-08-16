import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import pool from "../db";
import { Request, Response, NextFunction } from "express";

dotenv.config();

// 1. Extend the Express Request type so TypeScript knows about req.user
export interface AuthRequest extends Request {
  user?: {id:string,username:string,email?: string, is_email_verified?:boolean};
}

export const verifyAccessToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = (authHeader && authHeader.split(" ")[1]) || req.body?.accessToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN!) as { id: string; username: string; email?: string; is_email_verified?: boolean };
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }
};