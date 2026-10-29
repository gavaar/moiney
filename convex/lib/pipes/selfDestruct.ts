import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { MAX_PIPES_PER_USER } from "../constants";
import { startPipeDeletionOperation, type ScheduleDeletion } from "./delete/operations";
import { executePipeRule } from "./pipes";

export async function startNextSelfDestruct(
  ctx: MutationCtx, userId: Id<"users">, now: number, scheduleDeletion: ScheduleDeletion,
): Promise<null> {
  const pipes = await ctx.db.query("pipes").withIndex("by_userId", (q) => q.eq("userId", userId)).take(MAX_PIPES_PER_USER);
  // Deleting a sibling can redistribute liquidity. Plan only one automatic
  // deletion at a time and resume after completion, rather than freezing stale balances.
  if (pipes.some((pipe) => pipe.deletionJobId)) return null;
  const parents = new Set(pipes.flatMap((pipe) => pipe.parentId ? [pipe.parentId] : []));
  const next = pipes.filter((pipe) => pipe.rule === "self_destruct" && pipe.parentId &&
    !parents.has(pipe._id) && pipe.cronNextDate !== undefined && pipe.cronNextDate <= now)
    .sort((a, b) => a.cronNextDate! - b.cronNextDate!)[0];
  if (next) {
    // Settlement and freezing share this transaction, so retries cannot cover or
    // settle twice. The deletion plan must use the post-coverage snapshot.
    const { after, coverage } = await executePipeRule(ctx, next._id, { pipe: next, now, cause: "self_destruct" });
    const settled = pipes.map(pipe => pipe._id === next._id ? after
      : coverage && pipe._id === coverage.after._id ? coverage.after : pipe);
    await startPipeDeletionOperation(ctx, userId, {
      pipeId: next._id, deleteTransactions: false,
    }, scheduleDeletion, settled);
  }
  return null;
}
