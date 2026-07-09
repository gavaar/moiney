import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getUserByUsername = query({
  args: { username: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
  },
});

export const insertUser = mutation({
  args: { username: v.string(), email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("users", args);
  },
});
