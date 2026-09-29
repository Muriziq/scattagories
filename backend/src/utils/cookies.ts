import { Response } from "express";

const isProduction = process.env.NODE_ENV === "production";

export const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: (isProduction ? "strict" : "lax") as "strict" | "lax",
};

export function setRefreshTokenCookie(res: Response, token: string, days: number = 7): void {
  res.cookie("refreshToken", token, {
    ...cookieOptions,
    maxAge: days * 24 * 60 * 60 * 1000,
  });
}

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

export function clearAuthCookies(res: Response): void {
  clearRefreshTokenCookie(res);
  clearGuestTokenCookie(res);
}
