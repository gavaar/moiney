import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import {
  transactionRoleNames,
  type TransactionRole,
} from "../domain/transactions";
import {
  createTransactionOperation,
  editTransactionOperation,
} from "./lib/transactions/operations";
import { MAX_PIPES_PER_USER } from "./lib/constants";

const TITLE_USAGE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const TITLE_USAGE_CLEANUP_BATCH_SIZE = 100;
const RECENT_TRANSACTION_LIMIT = 30;
const TRANSACTION_CACHE_RECONCILIATION_LIMIT = 300;
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

function transactionsQuery(ctx: QueryCtx, userId: Id<"users">) {
  return ctx.db
    .query("transactions")
    .withIndex("by_userId_date", (q) => q.eq("userId", userId))
    .order("desc");
}

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

async function loadRecentTransactionsForRole(
  ctx: QueryCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  role: TransactionRole,
): Promise<Doc<"transactions">[]> {
  if (role === "from") {
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId_from_date", (q) =>
        q.eq("userId", userId).eq("from", pipeId),
      )
      .order("desc")
      .take(RECENT_TRANSACTION_LIMIT);
  }

  if (role === "to") {
    return await ctx.db
      .query("transactions")
      .withIndex("by_userId_to_date", (q) =>
        q.eq("userId", userId).eq("to", pipeId),
      )
      .order("desc")
      .take(RECENT_TRANSACTION_LIMIT);
  }

  return await ctx.db
    .query("transactions")
    .withIndex("by_userId_paidFrom_date", (q) =>
      q.eq("userId", userId).eq("paidFrom", pipeId),
    )
    .order("desc")
    .take(RECENT_TRANSACTION_LIMIT);
}

async function loadRecentTransactionsForPipes(
  ctx: QueryCtx,
  userId: Id<"users">,
  pipeIds: Id<"pipes">[],
): Promise<Doc<"transactions">[]> {
  const uniquePipeIds = [...new Set(pipeIds)];
  if (uniquePipeIds.length > MAX_PIPES_PER_USER) {
    throw new ConvexError({ code: "TOO_MANY_PIPE_FILTERS" });
  }

  const rows = await Promise.all(
    uniquePipeIds.flatMap((pipeId) =>
      transactionRoleNames.map((role) =>
        loadRecentTransactionsForRole(ctx, userId, pipeId, role),
      ),
    ),
  );
  const unique = new Map<Id<"transactions">, Doc<"transactions">>();
  for (const transaction of rows.flat()) {
    unique.set(transaction._id, transaction);
  }

  return [...unique.values()]
    .sort(
      (left, right) =>
        right.date - left.date || right._creationTime - left._creationTime,
    )
    .slice(0, RECENT_TRANSACTION_LIMIT);
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
  returns: transactionCacheItem,
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
  returns: transactionCacheItem,
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
    if (args.pipeIds && args.pipeIds.length > 0) {
      return await loadRecentTransactionsForPipes(ctx, userId, args.pipeIds);
    }
    return await transactionsQuery(ctx, userId).take(RECENT_TRANSACTION_LIMIT);
  },
});

export const listTransactionsByIds = query({
  args: {
    transactionIds: v.array(v.id("transactions")),
  },
  returns: v.array(transactionCacheItem),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    if (args.transactionIds.length > TRANSACTION_CACHE_RECONCILIATION_LIMIT) {
      throw new ConvexError({ code: "TOO_MANY_TRANSACTION_IDS" });
    }
    const transactionIds = [...new Set(args.transactionIds)];

    const rows = await Promise.all(
      transactionIds.map((transactionId) => ctx.db.get("transactions", transactionId)),
    );
    return rows
      .filter((transaction): transaction is Doc<"transactions"> =>
        transaction?.userId === userId,
      )
      .map(toTransactionCacheItem);
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
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const q = transactionsQuery(ctx, userId);
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
