import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { MAX_PIPES_PER_USER } from "./lib/constants";
import {
  addFeedToPipe,
  computePipeDerivedValues,
  distributeFedToChildren,
} from "./lib/pipes";

async function checkPipeLimit(ctx: MutationCtx, userId: Id<"users">) {
  const pipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (pipes.length >= MAX_PIPES_PER_USER) {
    throw new Error(
      `Pipe limit reached (max ${MAX_PIPES_PER_USER})`,
    );
  }
}

export const addFeed = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await checkPipeLimit(ctx, userId);

    return await ctx.db.insert("pipes", {
      userId,
      parentId: undefined,
      name: args.name,
      icon: args.icon,
      description: args.description,
      priority: 0,
      fed: 0,
    });
  },
});

export const addPipe = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
    priority: v.number(),
    capacity: v.optional(v.number()),
    parentId: v.id("pipes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await checkPipeLimit(ctx, userId);

    const childId = await ctx.db.insert("pipes", {
      userId,
      parentId: args.parentId,
      name: args.name,
      icon: args.icon,
      description: args.description,
      priority: args.priority,
      capacity: args.capacity,
      fed: 0,
      spent: 0,
    });

    const parent = await ctx.db.get(args.parentId);
    if (parent) {
      const patches: Record<string, undefined> = {};
      if (parent.capacity !== undefined) patches.capacity = undefined;
      if (parent.spent !== undefined) patches.spent = undefined;
      if (Object.keys(patches).length > 0) {
        await ctx.db.patch(parent._id, patches);
      }
    }

    await distributeFedToChildren(ctx, userId, args.parentId);

    return childId;
  },
});

export const feedPipe = mutation({
  args: {
    pipeId: v.id("pipes"),
    amount: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await addFeedToPipe(ctx, userId, args.pipeId, args.amount);
    await distributeFedToChildren(ctx, userId, args.pipeId);
  },
});

export const getPipes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const pipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const childrenByParent = new Map<Id<"pipes">, typeof pipes>();
    for (const pipe of pipes) {
      if (pipe.parentId) {
        const siblings = childrenByParent.get(pipe.parentId) ?? [];
        siblings.push(pipe);
        childrenByParent.set(pipe.parentId, siblings);
      }
    }

    return pipes.map((pipe) => {
      const children = childrenByParent.get(pipe._id) ?? [];
      const { capacity, spent, fed } = computePipeDerivedValues(pipe, children);
      return { ...pipe, capacity, spent, fed };
    });
  },
});
