import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { MAX_PIPES_PER_USER } from "./lib/constants";
import {
  addFeedToPipe,
  computePipeTree,
  recascadeTree,
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

    await recascadeTree(ctx, userId, args.parentId);

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
    await recascadeTree(ctx, userId, args.pipeId);
  },
});

export const deletePipe = mutation({
  args: {
    pipeId: v.id("pipes"),
    deleteTransactions: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    const allPipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    const childrenByParent = new Map<Id<"pipes">, Id<"pipes">[]>();
    for (const p of allPipes) {
      if (p.parentId) {
        const siblings = childrenByParent.get(p.parentId) ?? [];
        siblings.push(p._id);
        childrenByParent.set(p.parentId, siblings);
      }
    }

    // Collect all descendant IDs bottom-up (leaf-first)
    function collectDescendants(id: Id<"pipes">): Id<"pipes">[] {
      const ids: Id<"pipes">[] = [];
      for (const childId of childrenByParent.get(id) ?? []) {
        ids.push(...collectDescendants(childId));
        ids.push(childId);
      }
      return ids;
    }

    const descendants = collectDescendants(args.pipeId);
    const allToDelete = [args.pipeId, ...descendants];

    // Delete transactions in a single batch read if requested
    if (args.deleteTransactions) {
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.or(...allToDelete.map((id) => q.eq(q.field("pipeId"), id))),
        )
        .collect();
      for (const t of transactions) {
        await ctx.db.delete(t._id);
      }
    }

    // Delete pipes bottom-up (leaf-first), then the root
    for (const id of descendants) {
      await ctx.db.delete(id);
    }
    await ctx.db.delete(args.pipeId);

    // Recascade remaining tree
    const remainingPipes = allPipes.filter(
      (p) => !allToDelete.includes(p._id),
    );
    if (remainingPipes.length > 0) {
      await recascadeTree(ctx, userId, remainingPipes[0]._id);
    }
  },
});

export const updatePipe = mutation({
  args: {
    pipeId: v.id("pipes"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.string()),
    priority: v.optional(v.number()),
    capacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe || pipe.userId !== userId) throw new Error("Not found");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.description !== undefined) patch.description = args.description;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.capacity !== undefined) patch.capacity = args.capacity;

    await ctx.db.patch(args.pipeId, patch);
    await recascadeTree(ctx, userId, args.pipeId);
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

    const computed = computePipeTree(pipes);

    return pipes.map((pipe) => {
      const { capacity, spent, fed } = computed.get(pipe._id)!;
      return { ...pipe, capacity, spent, fed };
    });
  },
});
