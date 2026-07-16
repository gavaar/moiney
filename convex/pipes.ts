import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuth } from "./lib/auth";

export const addFeed = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    return await ctx.db.insert("pipes", {
      userId,
      parentId: undefined,
      name: args.name,
      icon: args.icon,
      description: args.description,
      priority: 0,
    });
  },
});

export const getPipes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    return await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});
