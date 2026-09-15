import crypto from "crypto";
import { Request } from "express";

export interface RefreshTokenSession {
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
  ip: string;
  userAgent: string;
  deviceId?: string;
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getClientInfo(req: Request) {
  const rawIp =
    (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
    req.ip ||
    req.socket?.remoteAddress ||
    "";
  const userAgent = (req.headers["user-agent"] as string) || "unknown";
  const deviceId = (req.headers["x-device-id"] as string) || undefined;
  return { ip: rawIp, userAgent, deviceId };
}

export function createSessionObject(
  token: string,
  req: Request,
  expiresInDays: number = 7
): RefreshTokenSession {
  const { ip, userAgent, deviceId } = getClientInfo(req);
  const now = Date.now();
  return {
    tokenHash: hashToken(token),
    createdAt: now,
    expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
    ip,
    userAgent,
    ...(deviceId ? { deviceId } : {}),
  };
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

  // Device Security Validation: Check deviceId consistency if present on both sides
  if (
    tokenMatched.deviceId &&
    clientInfo.deviceId &&
    tokenMatched.deviceId !== clientInfo.deviceId
    &&     tokenMatched.userAgent &&
    clientInfo.userAgent &&
    tokenMatched.userAgent !== "unknown" &&
    clientInfo.userAgent !== "unknown" &&
    tokenMatched.userAgent !== clientInfo.userAgent
  ) {
    // Device mismatch (stolen token presented on another physical device!)
    return { updatedSessions: [], isReuseDetected: true };
  }



  // Generate new rotated session object with updated IP & userAgent
  const newSession: RefreshTokenSession = {
    tokenHash: hashToken(newTokenRaw),
    createdAt: now,
    expiresAt: now + expiresInDays * 24 * 60 * 60 * 1000,
    ip: clientInfo.ip || tokenMatched.ip || "",
    userAgent: clientInfo.userAgent || tokenMatched.userAgent || "unknown",
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
