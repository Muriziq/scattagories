import jwt from "jsonwebtoken";

// Standard user claims embedded in authentication tokens
export interface UserPayload {
  id: string;
  username: string;
  email?: string;
  is_email_verified?: boolean;
  avatar_url?: string | null;
  role?: string;
}

// Signs short-lived (1 hour) access token for API and socket authorization
export function signAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.ACCESS_TOKEN!, { expiresIn: "1hr" });
}

// Signs long-lived (7 days) refresh token stored in HTTP-only cookie
export function signRefreshToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.REFRESH_TOKEN!, { expiresIn: "7d" });
}

// Signs short-lived (15 min) email verification link token
export function signVerifyToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.VERIFY_TOKEN!, { expiresIn: "15m" });
}

// Signs short-lived (15 min) password reset link token
export function signResetPasswordToken(payload: { id: string }): string {
  return jwt.sign(payload, process.env.RESET_PASSWORD_TOKEN!, { expiresIn: "15m" });
}

// Signs temporary (1 day) guest token for unregistered lobby play
export function signGuestToken(payload: UserPayload): string {
  return jwt.sign(payload, process.env.GUEST_TOKEN!, { expiresIn: "1d" });
}

// Token verification utilities
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
