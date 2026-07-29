import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import { requireAuth } from "./lib/auth";
import { calculateSpentUpdate, updateOrCreateTitleUsage } from "./lib/transactions";
import { recascadeTree } from "./lib/pipes";

function transactionsQuery(ctx: any, userId: string, pipeIds: string[] | undefined) {
  let q = ctx.db
    .query("transactions")
    .withIndex("by_userId_date", (q: any) => q.eq("userId", userId));

  if (pipeIds && pipeIds.length > 0) {
    q = q.filter((fq: any) =>
      fq.or(...pipeIds.map((id) => fq.eq(fq.field("from"), id))),
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
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    if (!args.from && !args.to) {
      throw new Error("Either 'from' or 'to' must be provided");
    }

    // Feed: no source pipe — money flows into `to`
    if (!args.from && args.to) {
      const destPipe = await ctx.db.get(args.to);
      if (!destPipe) throw new Error("Pipe not found");
      if (destPipe.userId !== userId) throw new Error("Not authorized");

      await ctx.db.patch(args.to, {
        fed: (destPipe.fed ?? 0) + args.value,
      });

      await ctx.db.insert("transactions", {
        title: args.title.toLowerCase(),
        value: args.value,
        date: args.date,
        from: undefined,
        to: args.to,
        userId,
      });

      await updateOrCreateTitleUsage(ctx, {
        pipeId: args.to,
        userId,
        title: args.title,
        date: args.date,
      });

      await recascadeTree(ctx, userId);
      return;
    }

    // Spend or Transfer: source pipe required
    const pipeId = args.from!;
    const pipe = await ctx.db.get(pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    if (args.to) {
      if (pipeId === args.to)
        throw new Error("Cannot transfer to self");

      const destPipe = await ctx.db.get(args.to);
      if (!destPipe) throw new Error("Destination pipe not found");
      if (destPipe.userId !== userId) throw new Error("Not authorized");

      await ctx.db.patch(pipeId, {
        fed: (pipe.fed ?? 0) + args.value,
      });
      await ctx.db.patch(args.to, {
        fed: (destPipe.fed ?? 0) - args.value,
      });

      await recascadeTree(ctx, userId);
    } else {
      await ctx.db.patch(pipeId, {
        spent: calculateSpentUpdate(pipe.spent, args.value),
      });
    }

    await ctx.db.insert("transactions", {
      title: args.title.toLowerCase(),
      value: args.value,
      date: args.date,
      from: pipeId,
      to: args.to,
      userId,
    });

    await updateOrCreateTitleUsage(ctx, {
      pipeId,
      userId,
      title: args.title,
      date: args.date,
    });
  },
});

export const editTransaction = mutation({
  args: {
    transactionId: v.id("transactions"),
    title: v.string(),
    value: v.number(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const tx = await ctx.db.get(args.transactionId);
    if (!tx) throw new Error("Transaction not found");
    if (tx.userId !== userId) throw new Error("Not authorized");

    const valueDiff = args.value - tx.value;

    if (valueDiff !== 0) {
      if (tx.from && tx.to) {
        const src = await ctx.db.get(tx.from);
        const dst = await ctx.db.get(tx.to);
        if (!src || !dst) throw new Error("Pipe not found");

        await ctx.db.patch(tx.from, { fed: (src.fed ?? 0) + valueDiff });
        await ctx.db.patch(tx.to, { fed: (dst.fed ?? 0) - valueDiff });
        await recascadeTree(ctx, userId);
      } else if (tx.from) {
        const pipe = await ctx.db.get(tx.from);
        if (!pipe) throw new Error("Pipe not found");

        await ctx.db.patch(tx.from, {
          spent: calculateSpentUpdate(pipe.spent, valueDiff),
        });
      } else if (tx.to) {
        const pipe = await ctx.db.get(tx.to);
        if (!pipe) throw new Error("Pipe not found");

        await ctx.db.patch(tx.to, { fed: (pipe.fed ?? 0) + valueDiff });
        await recascadeTree(ctx, userId);
      }
    }

    await ctx.db.patch(args.transactionId, {
      title: args.title.toLowerCase(),
      value: args.value,
      date: args.date,
    });

    await updateOrCreateTitleUsage(ctx, {
      pipeId: tx.from ?? tx.to!,
      userId,
      title: args.title,
      date: args.date,
    });
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
