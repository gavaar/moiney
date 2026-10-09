import type { Doc, Id } from "../../../_generated/dataModel";
import type { MutationCtx } from "../../../_generated/server";
import { internal } from "../../../_generated/api";
import { transactionRoleEntries } from "../../../../domain/transactions";
import { readFinancialSnapshot } from "../../events/financialSnapshot";
import { deleteHistoryOperation } from "../../events/persistence";
import { planTransactionDisposition, type DeletionPipeState } from "./transactionDisposition";

/** One indexed perspective stream per member; complete operations own disposition. */
export async function processEventDeletionPage(ctx: MutationCtx, job: Doc<"pipeDeletionJobs">, pipeId: Id<"pipes">) {
  const page = await ctx.db.query("events").withIndex("by_userId_pipeId_occurredAt", q =>
    q.eq("userId", job.userId).eq("pipeId", pipeId)).paginate({ numItems: 50, cursor: job.cursor ?? null });
  const members = new Set(job.memberPipeIds);
  for (const entry of page.page) {
    if (entry.type === "pipe_creation" || entry.type === "pipe_deletion") continue;
    if (!entry.operationId) throw new Error("History event is missing its operation ID");
    const snapshot = await readFinancialSnapshot(ctx, job.userId, entry.operationId);
    const roles = transactionRoleEntries(snapshot);
    // Assign shared operations to their first deleted member, not every perspective.
    const assigned = job.memberPipeIds.find(id => roles.some(role => role.pipeId === id));
    if (assigned !== pipeId) continue;
    const states: Record<string, DeletionPipeState> = {};
    for (const role of roles) {
      const pipe = await ctx.db.get("pipes", role.pipeId);
      if (pipe && pipe.userId !== job.userId) throw new Error("Not authorized");
      states[role.pipeId] = { status: pipe && !pipe.deletionJobId && !members.has(pipe._id) ? "survives" : "deleting" };
    }
    const disposition = planTransactionDisposition(snapshot, states, job.deleteTransactions);
    if (disposition.delete) {
      await deleteHistoryOperation(ctx, job.userId, entry.operationId);
      await ctx.scheduler.runAfter(0, internal.financialOperations.deleteCorrectionsBatch, { operationId: entry.operationId });
    }
  }
  return page;
}

export async function hasRetainedFinancialHistory(ctx: MutationCtx, userId: Id<"users">, pipeId: Id<"pipes">) {
  for (const type of ["feed", "transaction", "transfer", "third_party_transaction"] as const) {
    const event = await ctx.db.query("events").withIndex("by_userId_pipeId_type", q =>
      q.eq("userId", userId).eq("pipeId", pipeId).eq("type", type)).first();
    if (event) return true;
  }
  return false;
}
