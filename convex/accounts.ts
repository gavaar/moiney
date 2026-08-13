import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";
import { canonicalizeUsername } from "./lib/usernames";

export const isUsernameAvailable = query({
  args: { username: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const username = canonicalizeUsername(args.username);
    if (!username) return false;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    return existing === null;
  },
});

export const getUserByUsername = internalQuery({
  args: { username: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      password: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    return user ? { _id: user._id, password: user.password } : null;
  },
});

export const registerWithSession = internalMutation({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.string(),
    familyId: v.string(),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
  },
  returns: v.object({
    userId: v.id("users"),
    sessionId: v.id("sessions"),
  }),
  handler: async (ctx, args) => {
    const username = canonicalizeUsername(args.username);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .unique();
    if (existing) throw new Error("Account already exists");

    const userId = await ctx.db.insert("users", {
      username,
      email: args.email,
      password: args.password,
    });
    const sessionId = await ctx.db.insert("sessions", {
      userId,
      familyId: args.familyId,
      active: true,
      refreshTokenHash: args.refreshTokenHash,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });

    return { userId, sessionId };
  },
});
