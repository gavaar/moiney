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
  countDueCronOccurrences,
} from "../domain/scheduling";
import { computePipeTree } from "../domain/pipes";
import {
  addFeedOperation,
  addPipeOperation,
  collectChildSubtree,
  executePipeRuleNowOperation,
  executePipeRule,
  recalcPipeSubtree,
  resolveTopMostAncestor,
  updatePipeOperation,
  updatePipeRuleOperation,
} from "./lib/pipes";
import {
  deletionStartResult,
  deletionStatus,
  getPipeDeletionStatusOperation,
  processPipeDeletionOperation,
  startPipeDeletionOperation,
} from "./lib/pipes";

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
  returns: v.id("pipes"),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await addFeedOperation(ctx, userId, args);
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
    return await addPipeOperation(ctx, userId, args);
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
    return await updatePipeOperation(ctx, userId, args);
  },
});

export const updatePipeRule = mutation({
  args: {
    pipeId: v.id("pipes"),
    rule: v.optional(
      v.union(
        v.null(),
        v.literal("spend_overflow"),
        v.literal("instant_settlement"),
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
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await updatePipeRuleOperation(ctx, userId, args, Date.now());
  },
});

export const executePipeRuleNow = mutation({
  args: {
    pipeId: v.id("pipes"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await executePipeRuleNowOperation(
      ctx,
      userId,
      args.pipeId,
      Date.now(),
    );
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
      const dueOccurrences =
        pipe.cronNextDate != null && pipe.cronInterval
          ? countDueCronOccurrences(
              pipe.cronNextDate,
              pipe.cronInterval.interval,
              pipe.cronInterval.unit,
              now,
            )
          : 0;
      if (dueOccurrences === 0) continue;

      await executePipeRule(ctx, pipe._id, {
        now,
        pipe,
        capUpdateValue:
          pipe.capUpdateValue == null
            ? undefined
            : pipe.capUpdateValue * dueOccurrences,
      });
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
