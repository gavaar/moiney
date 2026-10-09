import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { planPipeDeletion } from "./plan";
import { computePipeTree, recalculatePipes } from "../../../../domain/pipes";
import type { DeletionPhase, DeletionStartResult } from "./contracts";
import { ensureLivePipeCreationHistory } from "../../pipeHistory";
import { processEventDeletionPage, hasRetainedFinancialHistory } from "./eventTraversal";
import { resolveTopMostAncestor } from "../pipes";
import { discardPipeLifecycleHistory, ensurePipeDeletionHistory } from "../../events/lifecycle";

export type ScheduleDeletion = (
  ctx: MutationCtx,
  jobId: Id<"pipeDeletionJobs">,
) => Promise<unknown>;

export function assertPipeNotDeleting(pipe: { deletionJobId?: unknown }) {
  if (pipe.deletionJobId) throw new Error("Pipe is being deleted");
}

export async function startPipeDeletionOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    pipeId: Id<"pipes">;
    deleteTransactions: boolean;
  },
  scheduleNext: ScheduleDeletion,
  knownPipes?: Doc<"pipes">[],
): Promise<DeletionStartResult> {
  const root = knownPipes ? knownPipes.find((pipe) => pipe._id === args.pipeId) : await ctx.db.get("pipes", args.pipeId);
  if (!root || root.userId !== userId) throw new Error("Pipe not found");

  if (root.deletionJobId) {
    const existing = await ctx.db.get("pipeDeletionJobs", root.deletionJobId);
    if (existing?.userId === userId) {
      return { jobId: existing._id, phase: existing.phase as DeletionPhase };
    }
    throw new Error("Pipe deletion state is invalid");
  }

  const allPipes = knownPipes ?? await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const plan = planPipeDeletion(allPipes, args.pipeId);
  const frozenPipeIds = new Set(
    allPipes.filter((pipe) => pipe.deletionJobId).map((pipe) => pipe._id),
  );
  if (plan.memberIds.some((pipeId) => frozenPipeIds.has(pipeId))) {
    throw new Error("Pipe is being deleted");
  }
  if (frozenPipeIds.size > 0) {
    const byId = new Map(allPipes.map((pipe) => [pipe._id, pipe]));
    const roots = new Map<Id<"pipes">, Id<"pipes">>();
    const getKnownPipe = async (id: Id<"pipes">) => byId.get(id) ?? null;
    const accountingRoot = await resolveTopMostAncestor(ctx, root._id, roots, getKnownPipe);
    for (const frozenId of frozenPipeIds) {
      if (await resolveTopMostAncestor(ctx, frozenId, roots, getKnownPipe) === accountingRoot) {
        throw new Error("Pipe is being deleted");
      }
    }
  }
  const phase: DeletionPhase = "processingTransactions";
  const jobId = await ctx.db.insert("pipeDeletionJobs", {
    userId,
    parentPipeId: plan.parentId,
    deleteTransactions: args.deleteTransactions,
    memberPipeIds: plan.memberIds,
    initialBalance: plan.balance,
    historySource: "events",
    phase,
    memberIndex: 0,
    role: undefined,
    cursor: undefined,
  });
  for (const pipeId of plan.memberIds) {
    await ctx.db.patch("pipes", pipeId, { deletionJobId: jobId });
  }
  await scheduleNext(ctx, jobId);
  return { jobId, phase };
}

export async function getPipeDeletionStatusOperation(
  ctx: QueryCtx,
  userId: Id<"users">,
  jobId: Id<"pipeDeletionJobs">,
) {
  const job = await ctx.db.get("pipeDeletionJobs", jobId);
  if (!job) return null;
  if (job.userId !== userId) throw new Error("Not authorized");
  return {
    jobId: job._id,
    phase: job.phase,
    deleteTransactions: job.deleteTransactions,
    totalMembers: job.memberPipeIds.length,
    completedMembers:
      job.phase === "complete" ? job.memberPipeIds.length : job.memberIndex,
  };
}

export async function processPipeDeletionOperation(
  ctx: MutationCtx,
  jobId: Id<"pipeDeletionJobs">,
  scheduleNext: ScheduleDeletion,
  onComplete?: (ctx: MutationCtx, userId: Id<"users">) => Promise<unknown>,
): Promise<null> {
  const job = await ctx.db.get("pipeDeletionJobs", jobId);
  if (!job || job.phase === "complete") return null;
  if (job.historySource !== "events") throw new Error("Legacy pipe deletion job is no longer supported");

  if (job.phase === "processingTransactions") {
    const pipeId = job.memberPipeIds[job.memberIndex];
    if (!pipeId) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        phase: "readyToFinalize",
        memberIndex: 0,
        role: undefined,
        cursor: undefined,
      });
      await scheduleNext(ctx, job._id);
      return null;
    }

    const page = await processEventDeletionPage(ctx, job, pipeId);

    if (!page.isDone) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        cursor: page.continueCursor,
      });
      await scheduleNext(ctx, job._id);
      return null;
    }

    // Finish each member's archive while all ancestors still exist.
    // Do not backfill events only to discard them immediately.
    const retained = !job.deleteTransactions || await hasRetainedFinancialHistory(ctx, job.userId, pipeId);
    if (retained) {
      const pipe = await ctx.db.get("pipes", pipeId);
      if (!pipe) throw new Error("Pipe deletion state is invalid");
      await ensureLivePipeCreationHistory(ctx, pipe);
    } else {
      await discardPipeLifecycleHistory(ctx, job.userId, pipeId);
    }
    if (job.memberIndex + 1 < job.memberPipeIds.length) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        memberIndex: job.memberIndex + 1,
        role: undefined,
        cursor: undefined,
      });
    } else {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        phase: "readyToFinalize",
        memberIndex: 0,
        role: undefined,
        cursor: undefined,
      });
    }
    await scheduleNext(ctx, job._id);
    return null;
  }

  if (job.phase === "readyToFinalize") {
    const allPipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", job.userId))
      .collect();
    const deletedIds = new Set(job.memberPipeIds);
    for (const pipeId of job.memberPipeIds) {
      const pipe = allPipes.find((candidate) => candidate._id === pipeId);
      if (pipe?.deletionJobId !== job._id) {
        throw new Error("Pipe deletion state is invalid");
      }
    }

    const deletionRoot = allPipes.find(
      (pipe) =>
        deletedIds.has(pipe._id) &&
        (!pipe.parentId || !deletedIds.has(pipe.parentId)),
    );
    if (!deletionRoot) throw new Error("Pipe deletion state is invalid");
    const derived = computePipeTree(allPipes).get(deletionRoot._id);
    if (
      !derived ||
      derived.fed + (derived.pendingFedAdjustment ?? 0) - derived.spent !==
        job.initialBalance
    ) {
      throw new Error("Pipe deletion balance changed");
    }

    const remainingPipes = allPipes
      .filter((pipe) => !deletedIds.has(pipe._id))
      .map((pipe) =>
        pipe._id === job.parentPipeId
          ? { ...pipe, fed: pipe.fed + job.initialBalance }
          : pipe,
      );
    const restoredRulePipeId =
      job.parentPipeId &&
      remainingPipes.some(
        (pipe) => pipe._id === job.parentPipeId && pipe.parentId === undefined,
      ) &&
      !remainingPipes.some((pipe) => pipe.parentId === job.parentPipeId)
        ? job.parentPipeId
        : undefined;
    const reconciled = recalculatePipes(remainingPipes);

    const deletedAt = Date.now();
    for (const pipeId of job.memberPipeIds) {
      const creation = await ctx.db.query("events").withIndex("by_userId_pipeId_type", q =>
        q.eq("userId", job.userId).eq("pipeId", pipeId).eq("type", "pipe_creation")).unique();
      if (creation) {
        const pipe = allPipes.find(candidate => candidate._id === pipeId)!;
        const parent = allPipes.find(candidate => candidate._id === pipe.parentId) ?? null;
        const { snapshot } = await ensureLivePipeCreationHistory(ctx, pipe, parent);
        await ensurePipeDeletionHistory(ctx, snapshot, deletedAt);
      }
      await ctx.db.delete("pipes", pipeId);
    }
    for (const update of reconciled) {
      const current = remainingPipes.find((pipe) => pipe._id === update._id)!;
      if (current.fed !== update.fed || current._id === job.parentPipeId) {
        await ctx.db.patch(
          "pipes",
          update._id,
          update._id === restoredRulePipeId
            ? {
                fed: update.fed,
                rule: "instant_settlement",
                capUpdateValue: undefined,
                cronNextDate: undefined,
                cronInterval: undefined,
              }
            : { fed: update.fed },
        );
      }
    }
    await ctx.db.patch("pipeDeletionJobs", job._id, {
      phase: "complete",
    });
    await onComplete?.(ctx, job.userId);
  }
  return null;
}
