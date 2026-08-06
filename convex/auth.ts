"use node";
import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  generateRefreshToken,
  getRefreshExpiry,
  hashToken,
  signAccessToken,
} from "./lib/jwt";
import { hashPassword, verifyPassword } from "./lib/password";
import { canonicalizeUsername } from "./lib/usernames";

type AuthResult = {
  accessToken: string;
  refreshToken: string;
};

const authResultValidator = v.object({
  accessToken: v.string(),
  refreshToken: v.string(),
});

export const signUp = action({
  args: { username: v.string(), email: v.string(), password: v.string() },
  returns: authResultValidator,
  handler: async (ctx, args): Promise<AuthResult> => {
    const username = canonicalizeUsername(args.username);
    if (username.length < 1) throw new Error("Username is required");
    if (!/^\S+@\S+\.\S+$/.test(args.email)) throw new Error("Invalid email");
    if (args.password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    const existing = await ctx.runQuery(internal.accounts.getUserByUsername, {
      username,
    });
    if (existing) throw new Error("Account already exists");

    const userId: Id<"users"> = await ctx.runMutation(
      internal.accounts.insertUser,
      {
        username,
        email: args.email,
        password: hashPassword(args.password),
      },
    );

    const refreshToken = generateRefreshToken();
    const sessionId: string = await ctx.runMutation(
      "sessions:create" as any,
      { userId: userId as any, refreshTokenHash: hashToken(refreshToken), expiresAt: getRefreshExpiry() },
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
    const user: Doc<"users"> | null = await ctx.runQuery(
      internal.accounts.getUserByUsername,
      { username },
    );

    if (!user || !verifyPassword(args.password, user.password))
      throw new Error("Invalid credentials");

    const refreshToken = generateRefreshToken();
    const sessionId: string = await ctx.runMutation(
      "sessions:create" as any,
      { userId: user._id as any, refreshTokenHash: hashToken(refreshToken), expiresAt: getRefreshExpiry() },
    );

    return {
      accessToken: signAccessToken(user._id, sessionId),
      refreshToken,
    };
  },
});

export const refreshAccess = action({
  args: { refreshToken: v.string() },
  handler: async (ctx, args) => {
    const session: { _id: string; userId: string; expiresAt: number } | null = await ctx.runQuery(
      "sessions:getByHash" as any,
      { refreshTokenHash: hashToken(args.refreshToken) },
    );

    if (!session) throw new Error("Session not found");
    if (session.expiresAt < Date.now()) {
      await ctx.runMutation("sessions:deleteById" as any, { id: session._id });
      throw new Error("Session expired");
    }

    return { accessToken: signAccessToken(session.userId, session._id) };
  },
});

export const signOut = action({
  args: { refreshToken: v.string() },
  handler: async (ctx, args) => {
    const session: { _id: string } | null = await ctx.runQuery(
      "sessions:getByHash" as any,
      { refreshTokenHash: hashToken(args.refreshToken) },
    );

    if (session) {
      await ctx.runMutation("sessions:deleteById" as any, { id: session._id });
    }
  },
});
