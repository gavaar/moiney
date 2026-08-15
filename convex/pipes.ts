import { v } from "convex/values";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id, Doc } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import {
  computeCronNextDate,
  computeElapsedIntervals,
} from "../domain/scheduling";
import { computePipeTree } from "../domain/pipes";
import { assertAmountLimit } from "../domain/money";
import { MAX_PIPES_PER_USER } from "./lib/constants";
import {
  collectChildSubtree,
  executePipeRule,
  recalcPipeSubtree,
  recascadeTree,
  resolveTopMostAncestor,
} from "./lib/pipes";
import {
  assertPipeNotDeleting,
  deletionStartResult,
  deletionStatus,
  getPipeDeletionStatusOperation,
  processPipeDeletionOperation,
  startPipeDeletionOperation,
} from "./lib/pipes";

async function checkPipeLimit(ctx: MutationCtx, userId: Id<"users">) {
  const pipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  if (pipes.length >= MAX_PIPES_PER_USER) {
    throw new Error(`Pipe limit reached (max ${MAX_PIPES_PER_USER})`);
  }
}

function schedulePipeDeletion(
  ctx: MutationCtx,
  jobId: Id<"pipeDeletionJobs">,
): Promise<unknown> {
  return ctx.scheduler.runAfter(0, internal.pipes.processPipeDeletion, {
    jobId,
  });
}

export const startPipeDeletion = mutation({
  args: {
    pipeId: v.id("pipes"),
    deleteTransactions: v.boolean(),
  },
  returns: deletionStartResult,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await startPipeDeletionOperation(
      ctx,
      userId,
      args,
      schedulePipeDeletion,
    );
  },
});

export const getPipeDeletionStatus = query({
  args: { jobId: v.id("pipeDeletionJobs") },
  returns: deletionStatus,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await getPipeDeletionStatusOperation(ctx, userId, args.jobId);
  },
});

export const processPipeDeletion = internalMutation({
  args: { jobId: v.id("pipeDeletionJobs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    return await processPipeDeletionOperation(
      ctx,
      args.jobId,
      schedulePipeDeletion,
    );
  },
});

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
      pendingFedAdjustment: 0,
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
  returns: v.id("pipes"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const parent = await ctx.db.get("pipes", args.parentId);
    if (!parent || parent.userId !== userId) {
      throw new Error("Parent pipe not found");
    }
    assertPipeNotDeleting(parent);

    await checkPipeLimit(ctx, userId);

    const settledFed =
      parent.fed + (parent.pendingFedAdjustment ?? 0) - parent.spent;

    const childId = await ctx.db.insert("pipes", {
      userId,
      parentId: args.parentId,
      name: args.name,
      icon: args.icon,
      description: args.description,
      priority: args.priority,
      capacity: assertAmountLimit(args.capacity),
      fed: 0,
      spent: 0,
      pendingFedAdjustment: 0,
    });

    await ctx.db.patch("pipes", parent._id, {
      capacity: 0,
      fed: settledFed,
      spent: 0,
      pendingFedAdjustment: 0,
      rule: undefined,
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    });

    await recascadeTree(ctx, userId);

    return childId;
  },
});

export const updatePipe = mutation({
  args: {
    pipeId: v.id("pipes"),
    name: v.optional(v.string()),
    icon: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    priority: v.optional(v.number()),
    capacity: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");
    assertPipeNotDeleting(pipe);

    const patch: Record<string, unknown> = {};
    if (args.name !== undefined) patch.name = args.name;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.description !== undefined) {
      patch.description = args.description ?? undefined;
    }
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.capacity !== undefined) {
      patch.capacity = assertAmountLimit(args.capacity);
    }

    await ctx.db.patch(args.pipeId, patch);
    await recascadeTree(ctx, userId);
    return null;
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
    const now = Date.now();

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");
    assertPipeNotDeleting(pipe);

    const patch: Record<string, unknown> = {
      rule: args.rule ?? undefined,
      capUpdateValue:
        args.rule != null && args.capUpdateValue !== undefined
          ? assertAmountLimit(args.capUpdateValue)
          : undefined,
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
      patch.cronInterval = { interval: args.interval, unit: args.unit };
      patch.cronNextDate = computeCronNextDate(
        args.starting,
        args.interval,
        args.unit,
        now,
      );
      if (args.capUpdateValue != null) {
        const intervals = computeElapsedIntervals(
          args.starting,
          args.interval,
          args.unit,
          now,
        );
        patch.capacity =
          pipe.capacity + intervals * assertAmountLimit(args.capUpdateValue);
      }
    }

    await ctx.db.patch(args.pipeId, patch);
    await recascadeTree(ctx, userId);
  },
});

export const executePipeRuleNow = mutation({
  args: {
    pipeId: v.id("pipes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");
    assertPipeNotDeleting(pipe);

    await executePipeRule(ctx, args.pipeId, { pipe });
    await recalcPipeSubtree(ctx, args.pipeId);
  },
});

export const runDueCronRules = internalMutation({
  args: {
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const today = new Date(now);
    const startOfToday = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000;

    const pipes = await ctx.db
      .query("pipes")
      .withIndex("by_rule_cronNextDate", (q) =>
        q.eq("rule", "cron").lt("cronNextDate", endOfToday),
      )
      .collect();

    const rootCache = new Map<Id<"pipes">, Id<"pipes">>();
    const roots = new Set<Id<"pipes">>();
    const blockedRoots = new Set<Id<"pipes">>();
    const safeRoots = new Set<Id<"pipes">>();

    for (const pipe of pipes) {
      const rootId = await resolveTopMostAncestor(ctx, pipe._id, rootCache);
      if (blockedRoots.has(rootId)) continue;
      if (!safeRoots.has(rootId)) {
        const root = await ctx.db.get("pipes", rootId);
        const children = await collectChildSubtree(ctx, rootId);
        if (
          root?.deletionJobId ||
          children.some((child) => child.deletionJobId)
        ) {
          blockedRoots.add(rootId);
          continue;
        }
        safeRoots.add(rootId);
      }
      await executePipeRule(ctx, pipe._id, { now, pipe });
      roots.add(rootId);
    }

    for (const rootId of roots) {
      await recalcPipeSubtree(ctx, rootId);
    }
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
      return {
        ...pipe,
        capacity: v.capacity,
        spent: v.spent,
        fed: v.fed,
        pendingFedAdjustment: v.pendingFedAdjustment ?? 0,
      };
    }) as Doc<"pipes">[];
  },
});
