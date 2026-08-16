import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { requireAuth } from "./lib/auth";
import { transactionRoleNames } from "../domain/transactions";
import {
  createTransactionOperation,
  editTransactionOperation,
} from "./lib/transactions/operations";

const TITLE_USAGE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const TITLE_USAGE_CLEANUP_BATCH_SIZE = 100;
const correctionSnapshot = v.object({
  title: v.string(),
  value: v.number(),
  date: v.number(),
});
const correctionHistoryItem = v.object({
  correctionId: v.id("transactionCorrections"),
  editedAt: v.number(),
  previous: correctionSnapshot,
  current: correctionSnapshot,
});

function transactionsQuery(
  ctx: any,
  userId: string,
  pipeIds: string[] | undefined,
) {
  let q = ctx.db
    .query("transactions")
    .withIndex("by_userId_date", (q: any) => q.eq("userId", userId));

  if (pipeIds && pipeIds.length > 0) {
    q = q.filter((fq: any) =>
      fq.or(
        ...pipeIds.flatMap((id) =>
          transactionRoleNames.map((role) => fq.eq(fq.field(role), id)),
        ),
      ),
    );
  }

  return q.order("desc");
}

export const createTransaction = mutation({
  args: {
    title: v.string(),
    value: v.number(),
    date: v.number(),
    from: v.optional(v.id("pipes")),
    to: v.optional(v.id("pipes")),
    paidFrom: v.optional(v.id("pipes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await createTransactionOperation(ctx, userId, args, Date.now());
  },
});

export const editTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    title: v.string(),
    value: v.number(),
    date: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await editTransactionOperation(ctx, userId, args, Date.now());
  },
});

export const listTransactionCorrectionsPaginated = query({
  args: {
    transactionId: v.id("transactions"),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(correctionHistoryItem),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const transaction = await ctx.db.get("transactions", args.transactionId);
    if (!transaction) throw new Error("Transaction not found");
    if (transaction.userId !== userId) throw new Error("Not authorized");

    const page = await ctx.db
      .query("transactionCorrections")
      .withIndex("by_transactionId", (q) =>
        q.eq("transactionId", args.transactionId),
      )
      .order("desc")
      .paginate(args.paginationOpts);

    return {
      ...page,
      page: page.page.map((correction) => ({
        correctionId: correction._id,
        editedAt: correction.editedAt,
        previous: correction.previous,
        current: correction.current,
      })),
    };
  },
});

export const listTransactions = query({
  args: {
    pipeIds: v.optional(v.array(v.id("pipes"))),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const q = transactionsQuery(ctx, userId, args.pipeIds);
    return await q.take(12);
  },
});

export const listRecentTitles = query({
  args: {
    pipeId: v.id("pipes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const rows = await ctx.db
      .query("transactionTitleUsage")
      .withIndex("by_pipeId_userId_count_lastUsedAt", (q: any) =>
        q.eq("pipeId", args.pipeId).eq("userId", userId),
      )
      .order("desc")
      .take(10);

    return rows.map((r) => r.title);
  },
});

export const listTransactionsPaginated = query({
  args: {
    pipeIds: v.optional(v.array(v.id("pipes"))),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const q = transactionsQuery(ctx, userId, args.pipeIds);
    return await q.paginate(args.paginationOpts);
  },
});

export const cleanupStaleTitleUsage = internalMutation({
  args: { now: v.optional(v.number()) },
  returns: v.object({ deleted: v.number(), hasMore: v.boolean() }),
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const staleRows = await ctx.db
      .query("transactionTitleUsage")
      .withIndex("by_lastUsedAt", (q) =>
        q.lt("lastUsedAt", now - TITLE_USAGE_RETENTION_MS),
      )
      .take(TITLE_USAGE_CLEANUP_BATCH_SIZE);

    for (const row of staleRows) {
      await ctx.db.delete("transactionTitleUsage", row._id);
    }

    const hasMore = staleRows.length === TITLE_USAGE_CLEANUP_BATCH_SIZE;
    if (hasMore) {
      await ctx.scheduler.runAfter(
        0,
        internal.transactions.cleanupStaleTitleUsage,
        { now },
      );
    }
    return { deleted: staleRows.length, hasMore };
  },
});
