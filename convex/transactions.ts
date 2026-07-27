import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { requireAuth } from "./lib/auth";
import { calculateSpentUpdate } from "./lib/transactions";
import { recascadeTree } from "./lib/pipes";

function transactionsQuery(ctx: any, userId: string, pipeIds: string[] | undefined) {
  let q = ctx.db
    .query("transactions")
    .withIndex("by_userId_date", (q: any) => q.eq("userId", userId));

  if (pipeIds && pipeIds.length > 0) {
    q = q.filter((fq: any) =>
      fq.or(...pipeIds.map((id) => fq.eq(fq.field("pipeId"), id))),
    );
  }

  return q.order("desc");
}

export const createTransaction = mutation({
  args: {
    title: v.string(),
    value: v.number(),
    date: v.number(),
    pipeId: v.id("pipes"),
    sentToPipeId: v.optional(v.id("pipes")),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    if (args.sentToPipeId) {
      if (args.pipeId === args.sentToPipeId)
        throw new Error("Cannot transfer to self");

      const destPipe = await ctx.db.get(args.sentToPipeId);
      if (!destPipe) throw new Error("Destination pipe not found");
      if (destPipe.userId !== userId) throw new Error("Not authorized");

      await ctx.db.patch(args.pipeId, {
        fed: (pipe.fed ?? 0) + args.value,
      });
      await ctx.db.patch(args.sentToPipeId, {
        fed: (destPipe.fed ?? 0) - args.value,
      });

      await recascadeTree(ctx, userId);
    } else {
      await ctx.db.patch(args.pipeId, {
        spent: calculateSpentUpdate(pipe.spent, args.value),
      });
    }

    await ctx.db.insert("transactions", {
      title: args.title.toLowerCase(),
      value: args.value,
      date: args.date,
      pipeId: args.pipeId,
      sentToPipeId: args.sentToPipeId,
      userId,
    });

    const existingTitleUsage = await ctx.db
      .query("transactionTitleUsage")
      .withIndex("by_pipeId_userId_title", (q: any) =>
        q.eq("pipeId", args.pipeId).eq("userId", userId).eq("title", args.title.toLowerCase()),
      )
      .first();

    if (existingTitleUsage) {
      await ctx.db.patch(existingTitleUsage._id, {
        count: existingTitleUsage.count + 1,
        lastUsedAt: args.date,
      });
    } else {
      await ctx.db.insert("transactionTitleUsage", {
        pipeId: args.pipeId,
        userId,
        title: args.title.toLowerCase(),
        count: 1,
        lastUsedAt: args.date,
      });
    }
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
