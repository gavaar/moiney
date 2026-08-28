import { v } from "convex/values";
import {
  summarizeMonthlySpending,
  type MonthlySpendingSummary,
} from "../domain/statistics/monthlySpending";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx } from "./_generated/server";

const USER_PAGE_SIZE = 50;
const TRANSACTION_PAGE_SIZE = 100;

const summaryValidator = v.object({
  grossSpendingCents: v.number(),
  refundCents: v.number(),
  spendingTransactionCount: v.number(),
  refundTransactionCount: v.number(),
  largestSpendingTransactionCents: v.number(),
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
      grossSpendingCents: 0,
      refundCents: 0,
      spendingTransactionCount: 0,
      refundTransactionCount: 0,
      largestSpendingTransactionCents: 0,
    };
    const summary = {
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

    await ctx.db.insert("monthlySpendingStats", {
      userId: args.userId,
      periodStart: args.periodStart,
      ...summary,
    });
    return null;
  },
});
