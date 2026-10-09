import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuth } from "./lib/auth";

const TITLE_USAGE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const TITLE_USAGE_CLEANUP_BATCH_SIZE = 100;

export const listRecentTitles = query({
  args: { pipeId: v.id("pipes") },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const rows = await ctx.db.query("transactionTitleUsage")
      .withIndex("by_pipeId_userId_count_lastUsedAt", q => q.eq("pipeId", args.pipeId).eq("userId", userId))
      .order("desc").take(10);
    return rows.map(row => row.title);
  },
});

export const cleanupStaleTitleUsage = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const staleRows = await ctx.db.query("transactionTitleUsage")
      .withIndex("by_lastUsedAt", q => q.lt("lastUsedAt", now - TITLE_USAGE_RETENTION_MS))
      .take(TITLE_USAGE_CLEANUP_BATCH_SIZE);
    for (const row of staleRows) await ctx.db.delete("transactionTitleUsage", row._id);
    const hasMore = staleRows.length === TITLE_USAGE_CLEANUP_BATCH_SIZE;
    if (hasMore) await ctx.scheduler.runAfter(0, internal.transactions.cleanupStaleTitleUsage, { now });
    return { deleted: staleRows.length, hasMore };
  },
});
