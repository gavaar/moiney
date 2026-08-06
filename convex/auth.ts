"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  generateRefreshToken,
  generateSessionFamilyId,
  getRefreshExpiry,
  hashToken,
  signAccessToken,
} from "./lib/jwt";
import { hashPassword, verifyPassword } from "./lib/password";
import { canonicalizeUsername } from "./lib/usernames";
import { authRateLimiter } from "./lib/authRateLimits";

type AuthResult = {
  accessToken: string;
  refreshToken: string;
};

const MAX_PASSWORD_LENGTH = 128;
const MAX_USERNAME_LENGTH = 64;
const MAX_EMAIL_LENGTH = 254;
const MAX_REFRESH_TOKEN_LENGTH = 128;

const authResultValidator = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
});

export const signUp = action({
  args: { username: v.string(), email: v.string(), password: v.string() },
  returns: authResultValidator,
  handler: async (ctx, args): Promise<AuthResult> => {
    const username = canonicalizeUsername(args.username);
    if (
      username.length > MAX_USERNAME_LENGTH ||
      args.email.length > MAX_EMAIL_LENGTH ||
      args.password.length > MAX_PASSWORD_LENGTH
    ) {
      throw new ConvexError({ code: "AUTH_INVALID_INPUT" });
    }
    const rateLimit = await authRateLimiter.limit(ctx, "signUp");
    if (!rateLimit.ok) {
      throw new ConvexError({
        code: "AUTH_RATE_LIMITED",
        retryAfter: rateLimit.retryAfter,
      });
    }
    if (username.length < 1) throw new Error("Username is required");
    if (!/^\S+@\S+\.\S+$/.test(args.email)) throw new Error("Invalid email");
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const refreshToken = generateRefreshToken();
    const familyId = generateSessionFamilyId();
    const { userId, sessionId }: {
      userId: Id<"users">;
      sessionId: Id<"sessions">;
    } = await ctx.runMutation(
      internal.accounts.registerWithSession,
      {
        username,
        email: args.email,
        password: hashPassword(args.password),
        familyId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: getRefreshExpiry(),
      },
    );

    return {
      accessToken: signAccessToken(userId, sessionId),
      refreshToken,
    };
  },
});

export const signIn = action({
  args: { username: v.string(), password: v.string() },
  returns: authResultValidator,
  handler: async (ctx, args): Promise<AuthResult> => {
    const username = canonicalizeUsername(args.username);
    if (
      username.length > MAX_USERNAME_LENGTH ||
      args.password.length > MAX_PASSWORD_LENGTH
    ) {
      throw new ConvexError({ code: "AUTH_INVALID_INPUT" });
    }
    const rateLimit = await authRateLimiter.limit(ctx, "signIn", {
      key: username,
    });
    if (!rateLimit.ok) {
      throw new ConvexError({
        code: "AUTH_RATE_LIMITED",
        retryAfter: rateLimit.retryAfter,
      });
    }
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.accounts.getUserByUsername,
      { username },
    );

    if (!user || !verifyPassword(args.password, user.password))
      throw new Error("Invalid credentials");

    const refreshToken = generateRefreshToken();
    const familyId = generateSessionFamilyId();
    const sessionId: Id<"sessions"> = await ctx.runMutation(
      internal.sessions.create,
      {
        userId: user._id,
        familyId,
        refreshTokenHash: hashToken(refreshToken),
        expiresAt: getRefreshExpiry(),
      },
    );

    return {
      accessToken: signAccessToken(user._id, sessionId),
      refreshToken,
    };
  },
});

export const refreshAccess = action({
  args: { refreshToken: v.string() },
  returns: authResultValidator,
  handler: async (ctx, args): Promise<AuthResult> => {
    if (args.refreshToken.length > MAX_REFRESH_TOKEN_LENGTH) {
      throw new ConvexError({ code: "AUTH_INVALID_INPUT" });
    }
    const rateLimit = await authRateLimiter.limit(ctx, "refresh");
    if (!rateLimit.ok) {
      throw new ConvexError({
        code: "AUTH_RATE_LIMITED",
        retryAfter: rateLimit.retryAfter,
      });
    }
    const replacementToken = generateRefreshToken();
    const rotation = await ctx.runMutation(
      internal.sessions.rotateRefreshToken,
      {
        refreshTokenHash: hashToken(args.refreshToken),
        replacementTokenHash: hashToken(replacementToken),
        replacementExpiresAt: getRefreshExpiry(),
      },
    );

    if (rotation.status === "expired") throw new Error("Session expired");
    if (rotation.status !== "rotated") throw new Error("Session invalid");

    return {
      accessToken: signAccessToken(rotation.userId, rotation.sessionId),
      refreshToken: replacementToken,
    };
  },
});

export const signOut = action({
  args: { refreshToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (args.refreshToken.length > MAX_REFRESH_TOKEN_LENGTH) {
      throw new ConvexError({ code: "AUTH_INVALID_INPUT" });
    }
    await ctx.runMutation(internal.sessions.revokeSessionFamily, {
      refreshTokenHash: hashToken(args.refreshToken),
    });
    return null;
  },
});
