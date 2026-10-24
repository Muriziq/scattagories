import { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

// Shared cookie security configuration
export const cookieOptions = {
  httpOnly: true, // Prevents client-side JavaScript access (mitigates XSS)
  secure: isProduction, // Enforces HTTPS in production environments
  sameSite: (isProduction ? "strict" : "lax") as "strict" | "lax",
};

// Sets HTTP-only 7-day refresh token cookie for persistent user sessions
export function setRefreshTokenCookie(res: Response, token: string, days: number = 7): void {
  res.cookie("refreshToken", token, {
    ...cookieOptions,
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

// Sets HTTP-only 1-day guest token cookie for temporary anonymous players
export function setGuestTokenCookie(res: Response, token: string, days: number = 1): void {
  res.cookie("guestToken", token, {
    ...cookieOptions,
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refreshToken", cookieOptions);
}

export function clearGuestTokenCookie(res: Response): void {
  res.clearCookie("guestToken", cookieOptions);
}

// Clears all authentication cookies during logout or session invalidation
export function clearAuthCookies(res: Response): void {
  clearRefreshTokenCookie(res);
  clearGuestTokenCookie(res);
}
