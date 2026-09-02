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
import { computePipeTree } from "../domain/pipes";
import {
  addFeedOperation,
  addPipeOperation,
  type CronContinuation,
  executePipeRuleNowOperation,
  runDueCronRulesOperation,
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

function scheduleDueCronRules(
  ctx: MutationCtx,
  args: CronContinuation,
): Promise<unknown> {
  return ctx.scheduler.runAfter(0, internal.pipes.runDueCronRules, args);
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
    sourceType: v.optional(
      v.union(v.literal("feed"), v.literal("boiler")),
    ),
    initialFed: v.optional(v.number()),
    contributedFed: v.optional(v.number()),
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
    cursor: v.optional(v.string()),
    pendingPipeIds: v.optional(v.array(v.id("pipes"))),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    return runDueCronRulesOperation(ctx, args, scheduleDueCronRules);
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
