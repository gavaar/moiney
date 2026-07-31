import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

export function calculateSpentUpdate(
  currentSpent: number,
  value: number,
): number {
  return currentSpent + -1 * value;
}

export async function updateOrCreateTitleUsage(
  ctx: MutationCtx,
  args: { pipeId: Id<"pipes">; userId: Id<"users">; title: string; date: number },
) {
  const existing = await ctx.db
    .query("transactionTitleUsage")
    .withIndex("by_pipeId_userId_title", (q: any) =>
      q.eq("pipeId", args.pipeId).eq("userId", args.userId).eq("title", args.title.toLowerCase()),
    )
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      lastUsedAt: args.date,
    });
  } else {
    await ctx.db.insert("transactionTitleUsage", {
      pipeId: args.pipeId,
      userId: args.userId,
      title: args.title.toLowerCase(),
      count: 1,
      lastUsedAt: args.date,
    });
  }
}
