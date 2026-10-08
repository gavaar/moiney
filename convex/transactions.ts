import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireAuth } from "./lib/auth";
import { correctionHistoryItem } from "./lib/events/corrections";
import {
  correctBoilerCurrentFedOperation,
  createTransactionOperation,
  deleteTransactionOperation,
  editTransactionOperation,
} from "./lib/transactions/operations";

const TITLE_USAGE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const TITLE_USAGE_CLEANUP_BATCH_SIZE = 100;
const transactionCacheItem = v.object({
  id: v.id("transactions"),
  createdAt: v.number(),
  title: v.string(),
  value: v.number(),
  date: v.number(),
  kind: v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer")),
  from: v.optional(v.id("pipes")),
  to: v.optional(v.id("pipes")),
  paidFrom: v.optional(v.id("pipes")),
  fromIcon: v.optional(v.string()),
  toIcon: v.optional(v.string()),
  paidFromIcon: v.optional(v.string()),
  editedAt: v.optional(v.number()),
});

function toTransactionCacheItem(transaction: Doc<"transactions">) {
  const item = {
    id: transaction._id,
    createdAt: transaction._creationTime,
    title: transaction.title,
    value: transaction.value,
    date: transaction.date,
    kind: transaction.kind,
  } as {
    id: Id<"transactions">;
    createdAt: number;
    title: string;
    value: number;
    date: number;
    kind: Doc<"transactions">["kind"];
    from?: Id<"pipes">;
    to?: Id<"pipes">;
    paidFrom?: Id<"pipes">;
    fromIcon?: string;
    toIcon?: string;
    paidFromIcon?: string;
    editedAt?: number;
  };

  if (transaction.from !== undefined) item.from = transaction.from;
  if (transaction.to !== undefined) item.to = transaction.to;
  if (transaction.paidFrom !== undefined) item.paidFrom = transaction.paidFrom;
  if (transaction.fromIcon !== undefined) item.fromIcon = transaction.fromIcon;
  if (transaction.toIcon !== undefined) item.toIcon = transaction.toIcon;
  if (transaction.paidFromIcon !== undefined) item.paidFromIcon = transaction.paidFromIcon;
  if (transaction.editedAt !== undefined) item.editedAt = transaction.editedAt;

  return item;
}

/** Temporary action bridge while installed clients and correction APIs use transaction IDs. */
export const forEventOperation = query({
  args: { operationId: v.id("events") },
  returns: v.union(v.null(), transactionCacheItem),
  handler: async (ctx, { operationId }) => {
    const userId = await requireAuth(ctx);
    const event = await ctx.db.get("events", operationId);
    if (!event || event.userId !== userId || event.operationId !== operationId ||
      event.type === "pipe_creation" || event.type === "pipe_deletion") return null;
    const transaction = await ctx.db.query("transactions")
      .withIndex("by_userId_operationId", q => q.eq("userId", userId).eq("operationId", operationId)).unique();
    return transaction ? toTransactionCacheItem(transaction) : null;
  },
});

export const createTransaction = mutation({
  args: {
    title: v.string(),
    value: v.number(),
    date: v.number(),
    from: v.optional(v.id("pipes")),
    to: v.optional(v.id("pipes")),
    paidFrom: v.optional(v.id("pipes")),
  },
  returns: transactionCacheItem,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await createTransactionOperation(ctx, userId, args, Date.now());
  },
});

export const contributeToBoiler = mutation({
  args: {
    pipeId: v.id("pipes"),
    title: v.string(),
    value: v.number(),
    date: v.number(),
    currentFed: v.optional(v.number()),
  },
  returns: v.union(transactionCacheItem, v.null()),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.value === 0) {
      if (args.currentFed === undefined) {
        throw new ConvexError({ code: "BOILER_UPDATE_EMPTY" });
      }
      await correctBoilerCurrentFedOperation(
        ctx,
        userId,
        args.pipeId,
        args.currentFed,
      );
      return null;
    }
    return await createTransactionOperation(
      ctx,
      userId,
      {
        title: args.title,
        value: args.value,
        date: args.date,
        to: args.pipeId,
        requireBoiler: true,
        currentFedOverride: args.currentFed,
      },
      Date.now(),
    );
  },
});

export const editTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    title: v.string(),
    value: v.number(),
    date: v.number(),
    primaryPipeId: v.optional(v.id("pipes")),
    applyReplacementEffects: v.optional(v.boolean()),
    target: v.optional(
      v.union(
        v.object({ type: v.literal("expense") }),
        v.object({ type: v.literal("transfer"), to: v.id("pipes") }),
        v.object({
          type: v.literal("payByTransfer"),
          paidFrom: v.id("pipes"),
        }),
      ),
    ),
  },
  returns: transactionCacheItem,
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    return await editTransactionOperation(ctx, userId, args, Date.now());
  },
});

export const deleteTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await deleteTransactionOperation(ctx, userId, args);
    await ctx.scheduler.runAfter(
      0,
      internal.transactions.deleteTransactionCorrectionsBatch,
      { transactionId: args.transactionId },
    );
    return null;
  },
});

export const deleteTransactionCorrectionsBatch = internalMutation({
  args: {
    transactionId: v.id("transactions"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const corrections = await ctx.db
      .query("transactionCorrections")
      .withIndex("by_transactionId", (q) =>
        q.eq("transactionId", args.transactionId),
      )
      .take(100);
    await Promise.all(
      corrections.map((correction) =>
        ctx.db.delete("transactionCorrections", correction._id),
      ),
    );
    if (corrections.length === 100) {
      await ctx.scheduler.runAfter(
        0,
        internal.transactions.deleteTransactionCorrectionsBatch,
        args,
      );
    }
    return null;
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
