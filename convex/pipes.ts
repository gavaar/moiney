import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id, Doc } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { MAX_PIPES_PER_USER } from "./lib/constants";
import {
  collectDescendants,
  computeCronNextDate,
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
      capacity: 0,
      fed: 0,
      spent: 0,
    });
  },
});

export const addPipe = mutation({
  args: {
    name: v.string(),
    icon: v.string(),
    description: v.optional(v.string()),
    priority: v.number(),
    capacity: v.number(),
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
      await ctx.db.patch(parent._id, { capacity: 0, spent: 0 });
    }

    await recascadeTree(ctx, userId);

    return childId;
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

    const descendants = collectDescendants(args.pipeId, childrenByParent);
    const allToDelete = [args.pipeId, ...descendants];

    if (args.deleteTransactions) {
      const transactions = await ctx.db
        .query("transactions")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .filter((q) =>
          q.or(...allToDelete.map((id) => q.eq(q.field("from"), id))),
        )
        .collect();
      for (const t of transactions) {
        await ctx.db.delete(t._id);
      }
    }

    for (const id of descendants) {
      await ctx.db.delete(id);
    }
    await ctx.db.delete(args.pipeId);

    const remainingPipes = allPipes.filter(
      (p) => !allToDelete.includes(p._id),
    );
    if (remainingPipes.length > 0) {
      await recascadeTree(ctx, userId);
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
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.description !== undefined) patch.description = args.description;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.capacity !== undefined) patch.capacity = args.capacity;

    await ctx.db.patch(args.pipeId, patch);
    await recascadeTree(ctx, userId);
  },
});

export const updatePipeRule = mutation({
  args: {
    pipeId: v.id("pipes"),
    rule: v.optional(
      v.union(
        v.null(),
        v.literal("spend_overflow"),
        v.literal("any_spend"),
        v.literal("cron"),
      ),
    ),
    interval: v.optional(v.number()),
    unit: v.optional(
      v.union(v.literal("days"), v.literal("months"), v.literal("years")),
    ),
    starting: v.optional(v.number()),
    capUpdateValue: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    const patch: Record<string, unknown> = {
      rule: args.rule ?? undefined,
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    };

    if (args.rule === "cron") {
      if (
        args.interval === undefined ||
        args.unit === undefined ||
        args.starting === undefined
      ) {
        throw new Error("Cron rule requires interval, unit, and starting");
      }
      patch.capUpdateValue = args.capUpdateValue;
      patch.cronInterval = { interval: args.interval, unit: args.unit };
      patch.cronNextDate = computeCronNextDate(
        args.starting,
        args.interval,
        args.unit,
      );
    }

    await ctx.db.patch(args.pipeId, patch);
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
      const v = computed.get(pipe._id)!;
      return { ...pipe, capacity: v.capacity, spent: v.spent, fed: v.fed };
    }) as Doc<"pipes">[];
  },
});
