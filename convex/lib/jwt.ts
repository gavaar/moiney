"use node";
import crypto from "crypto";
import { JWT_KEY_ID } from "./jwtPublic";

const ACCESS_TTL = 900;
const REFRESH_TTL = 30 * 24 * 60 * 60;

function requireEnvironmentValue(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

export function assertJwtKeyPair(
  privateKey: string,
  publicKey: string,
): void {
  const signingPublicKey = crypto
    .createPublicKey(privateKey)
    .export({ type: "spki", format: "der" });
  const configuredPublicKey = crypto
    .createPublicKey(publicKey)
    .export({ type: "spki", format: "der" });

  if (
    signingPublicKey.length !== configuredPublicKey.length ||
    !crypto.timingSafeEqual(signingPublicKey, configuredPublicKey)
  ) {
    throw new Error("JWT key pair does not match");
  }
}

function base64url(data: Buffer): string {
  return data
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function signAccessToken(userId: string, sessionId: string): string {
  const privateKey = requireEnvironmentValue("JWT_PRIVATE_KEY");
  const publicKey = requireEnvironmentValue("JWT_PUBLIC_KEY");
  const siteUrl = requireEnvironmentValue("CONVEX_SITE_URL");
  assertJwtKeyPair(privateKey, publicKey);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT", kid: JWT_KEY_ID };
  const payload = {
    sub: userId,
    sessionId,
    iss: siteUrl,
    aud: "moiney",
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

export function generateSessionFamilyId(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function getRefreshExpiry(): number {
  return Date.now() + REFRESH_TTL * 1000;
}
