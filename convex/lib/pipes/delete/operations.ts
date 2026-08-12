import type { Id } from "../../../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../../../_generated/server";
import { planPipeDeletion } from "./plan";
import {
  computePipeTree,
  recalculatePipes,
} from "../../../../domain/pipes";
import {
  planTransactionDisposition,
  type DeletionPipeState,
} from "./transactionDisposition";
import type { DeletionPhase, DeletionStartResult } from "./contracts";

const PIPE_DELETION_TRANSACTION_BATCH_SIZE = 50;
const DELETION_ROLES = ["from", "to", "paidFrom"] as const;
type DeletionRole = (typeof DELETION_ROLES)[number];

export type ScheduleDeletion = (
  ctx: MutationCtx,
  jobId: Id<"pipeDeletionJobs">,
) => Promise<unknown>;

export function assertPipeNotDeleting(pipe: { deletionJobId?: unknown }) {
  if (pipe.deletionJobId) throw new Error("Pipe is being deleted");
}

function roleQuery(
  ctx: MutationCtx,
  role: DeletionRole,
  pipeId: Id<"pipes">,
) {
  if (role === "from") {
    return ctx.db
      .query("transactions")
      .withIndex("by_from", (q) => q.eq("from", pipeId));
  }
  if (role === "to") {
    return ctx.db
      .query("transactions")
      .withIndex("by_to", (q) => q.eq("to", pipeId));
  }
  return ctx.db
    .query("transactions")
    .withIndex("by_paidFrom", (q) => q.eq("paidFrom", pipeId));
}

async function loadPipeStates(
  ctx: MutationCtx,
  transactions: Array<{
    from?: Id<"pipes">;
    to?: Id<"pipes">;
    paidFrom?: Id<"pipes">;
  }>,
): Promise<Record<string, DeletionPipeState>> {
  const ids = new Set<Id<"pipes">>();
  for (const transaction of transactions) {
    if (transaction.from) ids.add(transaction.from);
    if (transaction.to) ids.add(transaction.to);
    if (transaction.paidFrom) ids.add(transaction.paidFrom);
  }

  const states: Record<string, DeletionPipeState> = {};
  for (const pipeId of ids) {
    const pipe = await ctx.db.get("pipes", pipeId);
    states[pipeId] = {
      status: pipe && !pipe.deletionJobId ? "survives" : "deleting",
      icon: pipe?.icon,
    };
  }
  return states;
}

export async function startPipeDeletionOperation(
  ctx: MutationCtx,
  userId: Id<"users">,
  args: {
    pipeId: Id<"pipes">;
    deleteTransactions: boolean;
  },
  scheduleNext: ScheduleDeletion,
): Promise<DeletionStartResult> {
  const root = await ctx.db.get("pipes", args.pipeId);
  if (!root || root.userId !== userId) throw new Error("Pipe not found");

  if (root.deletionJobId) {
    const existing = await ctx.db.get(
      "pipeDeletionJobs",
      root.deletionJobId,
    );
    if (existing?.userId === userId) {
      return { jobId: existing._id, phase: existing.phase as DeletionPhase };
    }
    throw new Error("Pipe deletion state is invalid");
  }

  const allPipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();
  const plan = planPipeDeletion(allPipes, args.pipeId);
  const frozenPipeIds = new Set(
    allPipes
      .filter((pipe) => pipe.deletionJobId)
      .map((pipe) => pipe._id),
  );
  if (plan.memberIds.some((pipeId) => frozenPipeIds.has(pipeId))) {
    throw new Error("Pipe is being deleted");
  }
  const phase: DeletionPhase = "processingTransactions";
  const jobId = await ctx.db.insert("pipeDeletionJobs", {
    userId,
    parentPipeId: plan.parentId,
    deleteTransactions: args.deleteTransactions,
    memberPipeIds: plan.memberIds,
    initialBalance: plan.balance,
    phase,
    memberIndex: 0,
    role: "from",
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
): Promise<null> {
  const job = await ctx.db.get("pipeDeletionJobs", jobId);
  if (!job || job.phase === "complete") return null;

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

    const role = job.role ?? "from";
    const page = await roleQuery(ctx, role, pipeId).paginate({
      numItems: PIPE_DELETION_TRANSACTION_BATCH_SIZE,
      cursor: job.cursor ?? null,
    });
    const states = await loadPipeStates(ctx, page.page);

    for (const transaction of page.page) {
      const disposition = planTransactionDisposition(
        transaction,
        states,
        job.deleteTransactions,
      );
      if (disposition.delete) {
        await ctx.db.delete("transactions", transaction._id);
      } else if (Object.keys(disposition.patches).length > 0) {
        await ctx.db.patch("transactions", transaction._id, disposition.patches);
      }
    }

    if (!page.isDone) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        cursor: page.continueCursor,
      });
      await scheduleNext(ctx, job._id);
      return null;
    }

    const roleIndex = DELETION_ROLES.indexOf(role);
    const nextRole = DELETION_ROLES[roleIndex + 1];
    if (nextRole) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        role: nextRole,
        cursor: undefined,
      });
    } else if (job.memberIndex + 1 < job.memberPipeIds.length) {
      await ctx.db.patch("pipeDeletionJobs", job._id, {
        memberIndex: job.memberIndex + 1,
        role: "from",
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
    if (!derived || derived.fed - derived.spent !== job.initialBalance) {
      throw new Error("Pipe deletion balance changed");
    }

    const remainingPipes = allPipes
      .filter((pipe) => !deletedIds.has(pipe._id))
      .map((pipe) =>
        pipe._id === job.parentPipeId
          ? { ...pipe, fed: pipe.fed + job.initialBalance }
          : pipe,
      );
    const reconciled = recalculatePipes(remainingPipes);

    for (const pipeId of job.memberPipeIds) {
      await ctx.db.delete("pipes", pipeId);
    }
    for (const update of reconciled) {
      const current = remainingPipes.find((pipe) => pipe._id === update._id)!;
      if (current.fed !== update.fed || current._id === job.parentPipeId) {
        await ctx.db.patch("pipes", update._id, { fed: update.fed });
      }
    }
    await ctx.db.patch("pipeDeletionJobs", job._id, {
      phase: "complete",
    });
  }
  return null;
}
