import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { assertAmountLimit } from "../../../domain/money";
import type { RuleConfiguration } from "../../../domain/pipes/rules";
import { rulePatch } from "./ruleConfig";
import { MAX_PIPES_PER_USER } from "../constants";
import { ensurePipeCreationEvent } from "../pipeHistory";
import { assertPipeNotDeleting } from "./delete";
import { executePipeRule, reconcileAffectedPipeRoots } from "./pipes";

async function checkPipeLimit(
  ctx: MutationCtx,
  userId: Id<"users">,
): Promise<void> {
  const pipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .take(MAX_PIPES_PER_USER);
  if (pipes.length >= MAX_PIPES_PER_USER) {
    throw new ConvexError({ code: "PIPE_LIMIT_REACHED" });
  }
}

export type AddFeedCommand = {
  name: string;
  icon: string;
  description?: string;
  sourceType?: "feed" | "boiler";
  initialFed?: number;
  contributedFed?: number;
};

export async function addFeedOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: AddFeedCommand,
): Promise<Id<"pipes">> {
  const initialFed = assertAmountLimit(command.initialFed ?? 0);
  const contributedFed =
    command.sourceType === "boiler"
      ? assertAmountLimit(command.contributedFed ?? 0)
      : undefined;
  if (initialFed < 0 || (contributedFed ?? 0) < 0) {
    throw new ConvexError({ code: "INVALID_INITIAL_PIPE_VALUE" });
  }
  await checkPipeLimit(ctx, userId);
  const pipeId = await ctx.db.insert("pipes", {
    userId,
    parentId: undefined,
    name: command.name,
    icon: command.icon,
    description: command.description,
    priority: 0,
    capacity: 0,
    fed: initialFed,
    spent: 0,
    pendingFedAdjustment: 0,
    sourceType: command.sourceType ?? "feed",
    contributedFed,
    rule: "instant_settlement",
  });
  await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", pipeId))!);
  return pipeId;
}

export type AddPipeCommand = {
  name: string;
  icon: string;
  description?: string;
  priority: number;
  capacity: number;
  parentId: Id<"pipes">;
  ruleConfig?: RuleConfiguration;
};

export async function addPipeOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: AddPipeCommand,
  now: number = Date.now(),
): Promise<Id<"pipes">> {
  const parent = await ctx.db.get("pipes", command.parentId);
  if (!parent || parent.userId !== userId) {
    throw new ConvexError({ code: "PIPE_NOT_FOUND" });
  }
  assertPipeNotDeleting(parent);

  await checkPipeLimit(ctx, userId);

  const settledFed =
    parent.fed + (parent.pendingFedAdjustment ?? 0) - parent.spent;
  const capacity = assertAmountLimit(command.capacity);
  const initialRule = rulePatch({ capacity }, command.ruleConfig ?? {}, now);
  const childId = await ctx.db.insert("pipes", {
    userId,
    parentId: command.parentId,
    name: command.name,
    icon: command.icon,
    description: command.description,
    priority: command.priority,
    capacity,
    fed: 0,
    spent: 0,
    pendingFedAdjustment: 0,
    ...initialRule,
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
  await reconcileAffectedPipeRoots(ctx, [command.parentId]);
  await ensurePipeCreationEvent(ctx, (await ctx.db.get("pipes", childId))!);
  return childId;
}

export type UpdatePipeRuleCommand = RuleConfiguration & {
  pipeId: Id<"pipes">;
};

export async function updatePipeRuleOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: UpdatePipeRuleCommand,
  now: number,
): Promise<null> {
  const pipe = await ctx.db.get("pipes", command.pipeId);
  if (!pipe || pipe.userId !== userId) {
    throw new ConvexError({ code: "PIPE_NOT_FOUND" });
  }
  assertPipeNotDeleting(pipe);

  if (command.rule === "self_destruct") {
    const child = await ctx.db.query("pipes").withIndex("by_parentId", (q) => q.eq("parentId", pipe._id)).first();
    if (!pipe.parentId || child) throw new ConvexError({ code: "SELF_DESTRUCT_REQUIRES_CHILD_LEAF" });
  }
  const patch = rulePatch(pipe, command, now);
  if (!patch) return null;
  await ctx.db.patch("pipes", command.pipeId, patch);
  await reconcileAffectedPipeRoots(ctx, [command.pipeId]);
  return null;
}

export type UpdatePipeCommand = {
  pipeId: Id<"pipes">;
  name?: string;
  icon?: string;
  description?: string | null;
  priority?: number;
  capacity?: number;
};

export async function updatePipeOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: UpdatePipeCommand,
): Promise<null> {
  const pipe = await ctx.db.get("pipes", command.pipeId);
  if (!pipe || pipe.userId !== userId) {
    throw new ConvexError({ code: "PIPE_NOT_FOUND" });
  }
  assertPipeNotDeleting(pipe);

  const patch: Record<string, unknown> = {};
  if (command.name !== undefined) patch.name = command.name;
  if (command.icon !== undefined) patch.icon = command.icon;
  if (command.description !== undefined) {
    patch.description = command.description ?? undefined;
  }
  if (command.priority !== undefined) patch.priority = command.priority;
  if (command.capacity !== undefined) {
    patch.capacity = assertAmountLimit(command.capacity);
  }

  await ctx.db.patch("pipes", command.pipeId, patch);
  if (command.priority !== undefined || command.capacity !== undefined) {
    await reconcileAffectedPipeRoots(ctx, [command.pipeId]);
  }
  return null;
}

export async function executePipeRuleNowOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  now: number,
): Promise<null> {
  const pipe = await ctx.db.get("pipes", pipeId);
  if (!pipe || pipe.userId !== userId) {
    throw new ConvexError({ code: "PIPE_NOT_FOUND" });
  }
  assertPipeNotDeleting(pipe);

  if (pipe.rule === "self_destruct") throw new ConvexError({ code: "SELF_DESTRUCT_CANNOT_RUN_MANUALLY" });
  await executePipeRule(ctx, pipeId, { pipe, now });
  await reconcileAffectedPipeRoots(ctx, [pipeId]);
  return null;
}
