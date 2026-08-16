import { ConvexError } from "convex/values";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { assertAmountLimit } from "../../../domain/money";
import {
  countDueCronOccurrences,
  computeCronNextDate,
  type CronUnit,
} from "../../../domain/scheduling";
import { MAX_PIPES_PER_USER } from "../constants";
import { assertPipeNotDeleting } from "./delete";
import {
  executePipeRule,
  reconcileAffectedPipeRoots,
} from "./pipes";

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
};

export async function addFeedOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: AddFeedCommand,
): Promise<Id<"pipes">> {
  await checkPipeLimit(ctx, userId);
  return await ctx.db.insert("pipes", {
    userId,
    parentId: undefined,
    name: command.name,
    icon: command.icon,
    description: command.description,
    priority: 0,
    capacity: 0,
    fed: 0,
    spent: 0,
    pendingFedAdjustment: 0,
  });
}

export type AddPipeCommand = {
  name: string;
  icon: string;
  description?: string;
  priority: number;
  capacity: number;
  parentId: Id<"pipes">;
};

export async function addPipeOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  command: AddPipeCommand,
): Promise<Id<"pipes">> {
  const parent = await ctx.db.get("pipes", command.parentId);
  if (!parent || parent.userId !== userId) {
    throw new ConvexError({ code: "PIPE_NOT_FOUND" });
  }
  assertPipeNotDeleting(parent);

  await checkPipeLimit(ctx, userId);

  const settledFed =
    parent.fed + (parent.pendingFedAdjustment ?? 0) - parent.spent;
  const childId = await ctx.db.insert("pipes", {
    userId,
    parentId: command.parentId,
    name: command.name,
    icon: command.icon,
    description: command.description,
    priority: command.priority,
    capacity: assertAmountLimit(command.capacity),
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
  await reconcileAffectedPipeRoots(ctx, [command.parentId]);
  return childId;
}

export type UpdatePipeRuleCommand = {
  pipeId: Id<"pipes">;
  rule?: "spend_overflow" | "instant_settlement" | "cron" | null;
  interval?: number;
  unit?: CronUnit;
  starting?: number;
  capUpdateValue?: number;
};

function isSameUtcDay(left: number, right: number): boolean {
  const leftDate = new Date(left);
  const rightDate = new Date(right);
  return (
    leftDate.getUTCFullYear() === rightDate.getUTCFullYear() &&
    leftDate.getUTCMonth() === rightDate.getUTCMonth() &&
    leftDate.getUTCDate() === rightDate.getUTCDate()
  );
}

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

  if (
    command.rule === "cron" &&
    pipe.rule === "cron" &&
    command.starting !== undefined &&
    pipe.cronNextDate !== undefined &&
    command.capUpdateValue === pipe.capUpdateValue &&
    command.interval === pipe.cronInterval?.interval &&
    command.unit === pipe.cronInterval?.unit &&
    isSameUtcDay(command.starting, pipe.cronNextDate)
  ) {
    return null;
  }

  const patch: Record<string, unknown> = {
    rule: command.rule ?? undefined,
    capUpdateValue:
      command.rule != null && command.capUpdateValue !== undefined
        ? assertAmountLimit(command.capUpdateValue)
        : undefined,
    cronNextDate: undefined,
    cronInterval: undefined,
  };

  if (command.rule === "cron") {
    if (
      command.interval === undefined ||
      command.unit === undefined ||
      command.starting === undefined
    ) {
      throw new Error("Cron rule requires interval, unit, and starting");
    }
    patch.cronInterval = {
      interval: command.interval,
      unit: command.unit,
    };
    patch.cronNextDate = computeCronNextDate(
      command.starting,
      command.interval,
      command.unit,
      now,
    );
    if (command.capUpdateValue != null) {
      const firstOccurrence = computeCronNextDate(
        command.starting,
        command.interval,
        command.unit,
        command.starting - 1,
      );
      const intervals = countDueCronOccurrences(
        firstOccurrence,
        command.interval,
        command.unit,
        now,
      );
      patch.capacity = pipe.capacity + intervals * assertAmountLimit(command.capUpdateValue);
    }
  }

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

  await executePipeRule(ctx, pipeId, { pipe, now });
  await reconcileAffectedPipeRoots(ctx, [pipeId]);
  return null;
}
