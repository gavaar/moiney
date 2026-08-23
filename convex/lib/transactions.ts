import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { canonicalizeTransactionTitle } from "../../domain/transactions";

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
