import { v } from "convex/values";
import {
  summarizeMonthlySpending,
  summarizeRootFeedSnapshot,
  type MonthlySpendingSummary,
} from "../domain/statistics/monthlySpending";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { MAX_PIPES_PER_USER } from "./lib/constants";

const USER_PAGE_SIZE = 50;
const TRANSACTION_PAGE_SIZE = 100;
const MAX_MONTHLY_REPORTS = 24;

const summaryValidator = v.object({
  totalIncomeCents: v.optional(v.number()),
  grossSpendingCents: v.number(),
  refundCents: v.number(),
  spendingTransactionCount: v.number(),
  refundTransactionCount: v.number(),
  largestSpendingTransactionCents: v.number(),
});

const monthlySpendingStatValidator = v.object({
  periodStart: v.number(),
  totalIncomeCents: v.optional(v.number()),
  grossSpendingCents: v.number(),
  refundCents: v.number(),
  spendingTransactionCount: v.number(),
  refundTransactionCount: v.number(),
  largestSpendingTransactionCents: v.number(),
  volumeCents: v.optional(v.number()),
  producedCents: v.optional(v.number()),
});

function toPublicStat(stat: Doc<"monthlySpendingStats">) {
  return {
    periodStart: stat.periodStart,
    ...(stat.totalIncomeCents !== undefined
      ? { totalIncomeCents: stat.totalIncomeCents }
      : {}),
    grossSpendingCents: stat.grossSpendingCents,
    refundCents: stat.refundCents,
    spendingTransactionCount: stat.spendingTransactionCount,
    refundTransactionCount: stat.refundTransactionCount,
    largestSpendingTransactionCents: stat.largestSpendingTransactionCents,
    ...(stat.volumeCents !== undefined ? { volumeCents: stat.volumeCents } : {}),
    ...(stat.producedCents !== undefined
      ? { producedCents: stat.producedCents }
      : {}),
  };
}

export const listMine = query({
  args: {},
  returns: v.array(monthlySpendingStatValidator),
  handler: async (ctx) => {
    const userId = await requireAuth(ctx);
    const stats = await ctx.db
      .query("monthlySpendingStats")
      .withIndex("by_userId_periodStart", (q) => q.eq("userId", userId))
      .order("desc")
      .take(MAX_MONTHLY_REPORTS);
    return stats.map(toPublicStat);
  },
});

export const getMine = query({
  args: { periodStart: v.number() },
  returns: v.union(v.null(), monthlySpendingStatValidator),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const period = new Date(args.periodStart);
    if (
      !Number.isSafeInteger(args.periodStart) ||
      period.getTime() !== args.periodStart ||
      period.getUTCDate() !== 1 ||
      period.getUTCHours() !== 0 ||
      period.getUTCMinutes() !== 0 ||
      period.getUTCSeconds() !== 0 ||
      period.getUTCMilliseconds() !== 0
    ) {
      throw new Error("Invalid period start");
    }

    const stat = await ctx.db
      .query("monthlySpendingStats")
      .withIndex("by_userId_periodStart", (q) =>
        q.eq("userId", userId).eq("periodStart", args.periodStart),
      )
      .unique();
    return stat ? toPublicStat(stat) : null;
  },
});

function previousUtcMonth(now: number) {
  const date = new Date(now);
  const periodEnd = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  return {
    periodStart: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1),
    periodEnd,
  };
}

function scheduleUserCapture(
  ctx: MutationCtx,
  args: {
    userId: Id<"users">;
    periodStart: number;
    periodEnd: number;
    cursor?: string;
    summary?: MonthlySpendingSummary;
  },
) {
  return ctx.scheduler.runAfter(
    0,
    internal.monthlySpendingStats.captureUserMonth,
    args,
  );
}

export const capturePreviousMonth = internalMutation({
  args: {
    now: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const now = args.now ?? Date.now();
    const { periodStart, periodEnd } = previousUtcMonth(now);
    const users = await ctx.db.query("users").paginate({
      numItems: USER_PAGE_SIZE,
      cursor: args.cursor ?? null,
    });

    await Promise.all(
      users.page.map((user) =>
        scheduleUserCapture(ctx, { userId: user._id, periodStart, periodEnd }),
      ),
    );

    if (!users.isDone) {
      await ctx.scheduler.runAfter(
        0,
        internal.monthlySpendingStats.capturePreviousMonth,
        { now, cursor: users.continueCursor },
      );
    }

    return null;
  },
});

export const captureUserMonth = internalMutation({
  args: {
    userId: v.id("users"),
    periodStart: v.number(),
    periodEnd: v.number(),
    cursor: v.optional(v.string()),
    summary: v.optional(summaryValidator),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    if (args.cursor === undefined) {
      const existing = await ctx.db
        .query("monthlySpendingStats")
        .withIndex("by_userId_periodStart", (q) =>
          q.eq("userId", args.userId).eq("periodStart", args.periodStart),
        )
        .unique();
      if (existing) return null;
    }

    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_userId_date", (q) =>
        q
          .eq("userId", args.userId)
          .gte("date", args.periodStart)
          .lt("date", args.periodEnd),
      )
      .paginate({
        numItems: TRANSACTION_PAGE_SIZE,
        cursor: args.cursor ?? null,
      });
    const pageSummary = summarizeMonthlySpending(transactions.page);
    const previous = args.summary ?? {
      totalIncomeCents: 0,
      grossSpendingCents: 0,
      refundCents: 0,
      spendingTransactionCount: 0,
      refundTransactionCount: 0,
      largestSpendingTransactionCents: 0,
    };
    const summary = {
      totalIncomeCents:
        (previous.totalIncomeCents ?? 0) + pageSummary.totalIncomeCents,
      grossSpendingCents:
        previous.grossSpendingCents + pageSummary.grossSpendingCents,
      refundCents: previous.refundCents + pageSummary.refundCents,
      spendingTransactionCount:
        previous.spendingTransactionCount + pageSummary.spendingTransactionCount,
      refundTransactionCount:
        previous.refundTransactionCount + pageSummary.refundTransactionCount,
      largestSpendingTransactionCents: Math.max(
        previous.largestSpendingTransactionCents,
        pageSummary.largestSpendingTransactionCents,
      ),
    };

    if (!transactions.isDone) {
      await scheduleUserCapture(ctx, {
        userId: args.userId,
        periodStart: args.periodStart,
        periodEnd: args.periodEnd,
        cursor: transactions.continueCursor,
        summary,
      });
      return null;
    }

    const pipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .take(MAX_PIPES_PER_USER + 1);
    if (pipes.length > MAX_PIPES_PER_USER) {
      throw new Error("Pipe limit exceeded");
    }
    const feedSnapshot = summarizeRootFeedSnapshot(pipes);

    await ctx.db.insert("monthlySpendingStats", {
      userId: args.userId,
      periodStart: args.periodStart,
      ...summary,
      ...feedSnapshot,
    });
    return null;
  },
});
