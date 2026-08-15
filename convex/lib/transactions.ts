import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canonicalizeTransactionTitle } from "../../domain/transactions";

export function getTitleUsagePipeId<TPipeId extends string>(transaction: {
  from?: TPipeId;
  to?: TPipeId;
}): TPipeId {
  const pipeId = transaction.from ?? transaction.to;
  if (!pipeId) throw new Error("Transaction has no title-usage pipe");
  return pipeId;
}

export function calculateSpentUpdate(
  currentSpent: number,
  value: number,
): number {
  return currentSpent + -1 * value;
}

export function calculatePayByTransferUpdate(
  fromFed: number,
  fromSpent: number,
  paidFromFed: number,
  value: number,
) {
  return {
    fromFed: fromFed - value,
    fromSpent: calculateSpentUpdate(fromSpent, value),
    paidFromFed: paidFromFed + value,
  };
}

export async function updateOrCreateTitleUsage(
  ctx: Pick<MutationCtx, "db">,
  args: { pipeId: Id<"pipes">; userId: Id<"users">; title: string; now: number },
) {
  const title = canonicalizeTransactionTitle(args.title);
  const existing = await ctx.db
    .query("transactionTitleUsage")
    .withIndex("by_pipeId_userId_title", (q: any) =>
      q.eq("pipeId", args.pipeId).eq("userId", args.userId).eq("title", title),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      lastUsedAt: args.now,
    });
  } else {
    await ctx.db.insert("transactionTitleUsage", {
      pipeId: args.pipeId,
      userId: args.userId,
      title,
      count: 1,
      lastUsedAt: args.now,
    });
  }
}
