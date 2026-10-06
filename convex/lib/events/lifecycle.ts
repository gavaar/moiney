import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { deleteHistoryOperation, insertHistoryOperation, replaceHistoryOperation } from "./persistence";

export type PipeLifecycleSnapshot = Omit<Doc<"pipeCreationEvents">, "_id" | "_creationTime" | "deletedAt">;
type LifecycleType = "pipe_creation" | "pipe_deletion";

function lifecycleQuery(ctx: MutationCtx, userId: Id<"users">, pipeId: Id<"pipes">, type: LifecycleType) {
  return ctx.db.query("events").withIndex("by_userId_pipeId_type", q =>
    q.eq("userId", userId).eq("pipeId", pipeId).eq("type", type));
}

function lifecycleEntry(snapshot: PipeLifecycleSnapshot, type: LifecycleType, occurredAt: number) {
  return {
    type,
    userId: snapshot.userId,
    pipeId: snapshot.pipeId,
    occurredAt,
    name: snapshot.name,
    icon: snapshot.icon,
    pipeType: snapshot.pipeType,
    ancestorIds: snapshot.ancestorIds,
    parentName: snapshot.parentName,
    parentIcon: snapshot.parentIcon,
  };
}

/** Creation identity is per pipe; refresh its retained snapshot before physical deletion. */
export async function syncPipeCreationHistory(ctx: MutationCtx, snapshot: PipeLifecycleSnapshot) {
  const existing = await lifecycleQuery(ctx, snapshot.userId, snapshot.pipeId, "pipe_creation").unique();
  const entry = lifecycleEntry(snapshot, "pipe_creation", snapshot.occurredAt);
  if (!existing) {
    return (await insertHistoryOperation(ctx, { canonicalEvent: entry })).canonicalEvent.id;
  }
  if (existing.type !== "pipe_creation" || existing.operationId !== existing._id) {
    throw new Error("Invalid pipe creation operation");
  }
  if (existing.name !== entry.name || existing.icon !== entry.icon ||
    existing.parentName !== entry.parentName || existing.parentIcon !== entry.parentIcon ||
    existing.pipeType !== entry.pipeType || existing.occurredAt !== entry.occurredAt ||
    existing.ancestorIds.join() !== entry.ancestorIds.join()) {
    await replaceHistoryOperation(ctx, snapshot.userId, existing._id, { canonicalEvent: entry });
  }
  return existing._id;
}

/** Deletion is a separate non-accounting operation with the final retained presentation. */
export async function ensurePipeDeletionHistory(ctx: MutationCtx, snapshot: PipeLifecycleSnapshot, deletedAt: number) {
  const existing = await lifecycleQuery(ctx, snapshot.userId, snapshot.pipeId, "pipe_deletion").unique();
  if (existing) {
    if (existing.operationId !== existing._id) throw new Error("Invalid pipe deletion operation");
    return existing._id;
  }
  return (await insertHistoryOperation(ctx, {
    canonicalEvent: lifecycleEntry(snapshot, "pipe_deletion", deletedAt),
  })).canonicalEvent.id;
}

export async function discardPipeLifecycleHistory(ctx: MutationCtx, userId: Id<"users">, pipeId: Id<"pipes">) {
  for (const type of ["pipe_creation", "pipe_deletion"] as const) {
    const event = await lifecycleQuery(ctx, userId, pipeId, type).unique();
    if (event) await deleteHistoryOperation(ctx, userId, event._id);
  }
}
