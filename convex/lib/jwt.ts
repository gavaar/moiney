"use node";
import crypto from "crypto";

const ACCESS_TTL = 900;
const REFRESH_TTL = 30 * 24 * 60 * 60;

function base64url(data: Buffer): string {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signAccessToken(userId: string, sessionId: string): string {
  const privateKey = process.env.JWT_PRIVATE_KEY!;
  const siteUrl = process.env.CONVEX_SITE_URL!;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT", kid: "moikickstarter-key-v1" };
  const payload = {
    sub: userId,
    sessionId,
    iss: siteUrl,
    aud: "moikickstarter",
    iat: now,
    exp: now + ACCESS_TTL,
  };

  const h = base64url(Buffer.from(JSON.stringify(header)));
  const p = base64url(Buffer.from(JSON.stringify(payload)));
  const sig = base64url(
    crypto.sign("RSA-SHA256", Buffer.from(`${h}.${p}`), privateKey),
  );

  return `${h}.${p}.${sig}`;
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiry(): number {
  return Date.now() + REFRESH_TTL * 1000;
}