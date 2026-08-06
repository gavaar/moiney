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
      _creationTime: v.number(),
      username: v.string(),
      email: v.string(),
      password: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
  },
});

export const insertUser = internalMutation({
  args: { username: v.string(), email: v.string(), password: v.string() },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", args.username))
      .unique();
    if (existing) throw new Error("Account already exists");
    return await ctx.db.insert("users", args);
  },
});
