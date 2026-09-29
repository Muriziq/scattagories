import jwt from "jsonwebtoken";

export interface UserPayload {
  id: string;
  username: string;
  email?: string;
  is_email_verified?: boolean;
  role?: string;
}

export function signAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.ACCESS_TOKEN!, { expiresIn: "1hr" });
}

export function signRefreshToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.REFRESH_TOKEN!, { expiresIn: "7d" });
}

export function signVerifyToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.VERIFY_TOKEN!, { expiresIn: "15m" });
}

export function signResetPasswordToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.RESET_PASSWORD_TOKEN!, { expiresIn: "15m" });
}

export function signGuestToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.GUEST_TOKEN!, { expiresIn: "1d" });
}

export function verifyAccessToken<T = UserPayload>(token: string): T {
  return jwt.verify(token, process.env.ACCESS_TOKEN!) as T;
}

export function verifyRefreshToken<T = { id: string }>(token: string): T {
  return jwt.verify(token, process.env.REFRESH_TOKEN!) as T;
}

export function verifyVerifyToken<T = { id: string }>(token: string): T {
  return jwt.verify(token, process.env.VERIFY_TOKEN!) as T;
}

export function verifyResetPasswordToken<T = { id: string }>(token: string): T {
  return jwt.verify(token, process.env.RESET_PASSWORD_TOKEN!) as T;
}

export function verifyGuestToken<T = UserPayload>(token: string): T {
  return jwt.verify(token, process.env.GUEST_TOKEN!) as T;
}
