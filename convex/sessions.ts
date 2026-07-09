import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";

export const create = internalMutation({
  args: {
    userId: v.id("users"),
    refreshTokenHash: v.string(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sessions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getByHash = internalQuery({
  args: { refreshTokenHash: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_refreshTokenHash", (q) => q.eq("refreshTokenHash", args.refreshTokenHash))
      .unique();
  },
});

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const deleteById = internalMutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const deleteByUserId = internalMutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sessions = await ctx.db
      .query("sessions")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
  },
});

export const cleanupExpired = internalMutation({
  handler: async (ctx) => {
    const all = await ctx.db.query("sessions").collect();
    const now = Date.now();
    for (const session of all) {
      if (session.expiresAt < now) {
        await ctx.db.delete(session._id);
      }
    }
  },
});