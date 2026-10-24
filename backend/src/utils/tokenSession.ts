import crypto from "crypto";
import { Request } from "express";

export interface RefreshTokenSession {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  platform: string;
  deviceId?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function parsePlatform(userAgent: string): string {
  if (!userAgent || userAgent === "unknown") return "unknown";
  if (/android/i.test(userAgent)) return "Android";
  if (/iphone|ipad|ipod/i.test(userAgent)) return "iOS";
  if (/windows/i.test(userAgent)) return "Windows";
  if (/macintosh|mac os x/i.test(userAgent)) return "macOS";
  if (/linux/i.test(userAgent)) return "Linux";
  return "Other";
}

export function getClientInfo(req: Request) {
  const rawIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  const userAgent = (req.headers["user-agent"] as string) || "unknown";
  const platform = parsePlatform(userAgent);
  const deviceId = (req.headers["x-device-id"] as string) || undefined;
  return { ip: rawIp, platform, deviceId };
}

export function createSessionObject(
  token: string,
  req: Request,
  expiresInDays: number = 7
): RefreshTokenSession {
  const { ip, platform, deviceId } = getClientInfo(req);
  const now = Date.now();
  return {
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
    ip,
    platform,
    ...(deviceId ? { deviceId } : {}),
  };
}

export function removeSession(
  existingSessionsRaw: any,
  tokenToRemove: string
): RefreshTokenSession[] {
  const targetHash = hashToken(tokenToRemove);
  const existingArray = Array.isArray(existingSessionsRaw) ? existingSessionsRaw : [];
  return existingArray.filter(
    (s: any) =>
      s &&
      typeof s === "object" &&
      s.tokenHash !== targetHash &&
      s.token !== tokenToRemove
  );
}

export function verifyAndRotateSession(
  existingSessionsRaw: any,
  oldTokenRaw: string,
  newTokenRaw: string,
  req: Request,
  expiresInDays: number = 7
): { updatedSessions: RefreshTokenSession[]; isReuseDetected: boolean } {
  const now = Date.now();
  const oldHash = hashToken(oldTokenRaw);
  const clientInfo = getClientInfo(req);

  const existingArray = Array.isArray(existingSessionsRaw) ? existingSessionsRaw : [];

  // Filter out expired sessions
  const validUnexpired = existingArray.filter((s: any) => {
    if (!s || typeof s !== "object") return false;
    return s.expiresAt && typeof s.expiresAt === "number" && s.expiresAt > now;
  });

  // Check if presented old token hash exists
  const tokenMatched = validUnexpired.find(
    (s: RefreshTokenSession) => s.tokenHash === oldHash || (s as any).token === oldTokenRaw
  );

  if (!tokenMatched) {
    // Reuse / theft of an unknown or revoked token detected!
    return { updatedSessions: [], isReuseDetected: true };
  }

  // Backward compatibility: read legacy `userAgent` if `platform` is not yet stored
  const sessionPlatform = tokenMatched.platform || parsePlatform((tokenMatched as any).userAgent);

  // 1. Device ID Validation: If both have a deviceId and they differ -> Stolen token from another device!
  if (
    tokenMatched.deviceId &&
    clientInfo.deviceId &&
    tokenMatched.deviceId !== clientInfo.deviceId
  ) {
    return { updatedSessions: [], isReuseDetected: true };
  }

  // 2. Platform Validation: If both platforms are known and differ (e.g. issued on iOS, refreshed on Windows)
  if (
    sessionPlatform !== "unknown" &&
    clientInfo.platform !== "unknown" &&
    sessionPlatform !== clientInfo.platform
  ) {
    return { updatedSessions: [], isReuseDetected: true };
  }

  // Generate new rotated session object with updated IP & platform
  const newSession: RefreshTokenSession = {
    tokenHash: hashToken(newTokenRaw),
    createdAt: now,
    expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
    ip: clientInfo.ip || tokenMatched.ip || "",
    platform: clientInfo.platform !== "unknown" ? clientInfo.platform : sessionPlatform,
    ...(clientInfo.deviceId || tokenMatched.deviceId
      ? { deviceId: clientInfo.deviceId || tokenMatched.deviceId }
      : {}),
  };

  // Remove the old token session and append the new rotated session
  const remainingSessions = validUnexpired.filter(
    (s: RefreshTokenSession) => s.tokenHash !== oldHash && (s as any).token !== oldTokenRaw
  );

  return {
    updatedSessions: [...remainingSessions, newSession],
    isReuseDetected: false,
  };
}
