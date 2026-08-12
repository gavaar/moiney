import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { paginationOptsValidator } from "convex/server";
import { requireAuth } from "./lib/auth";
import { updateOrCreateTitleUsage } from "./lib/transactions";
import {
  executePipeRule,
  recalcPipeSubtree,
  recascadeTree,
  resolveTopMostAncestor,
} from "./lib/pipes";
import {
  deriveTransactionKind,
  transactionAccountingEffects,
  transactionRoleNames,
} from "../domain/transactions";

const TITLE_USAGE_RETENTION_MS = 365 * 24 * 60 * 60 * 1000;
const TITLE_USAGE_CLEANUP_BATCH_SIZE = 100;

function transactionsQuery(ctx: any, userId: string, pipeIds: string[] | undefined) {
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
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const usageNow = Date.now();

    if (args.paidFrom && (!args.from || args.to)) {
      throw new Error("Pay by transfer requires from and paidFrom only");
    }

    if (!args.from && !args.to) {
      throw new Error("Either 'from' or 'to' must be provided");
    }
    const kind = deriveTransactionKind(args);
    for (const pipeId of new Set([args.from, args.to, args.paidFrom])) {
      if (!pipeId) continue;
      const pipe = await ctx.db.get("pipes", pipeId);
      if (pipe?.deletionJobId) throw new Error("Pipe is being deleted");
    }

    // Feed: no source pipe — money flows into `to`
    if (!args.from && args.to) {
      const destPipe = await ctx.db.get(args.to);
      if (!destPipe) throw new Error("Pipe not found");
      if (destPipe.userId !== userId) throw new Error("Not authorized");

      await ctx.db.patch(args.to, {
        fed:
          destPipe.fed +
          transactionAccountingEffects({ to: args.to }, args.value).to.fedDelta,
      });

      await ctx.db.insert("transactions", {
        title: args.title.toLowerCase(),
        value: args.value,
        date: args.date,
        kind,
        from: undefined,
        to: args.to,
        userId,
      });

      await updateOrCreateTitleUsage(ctx, {
        pipeId: args.to,
        userId,
        title: args.title,
        now: usageNow,
      });

      await recascadeTree(ctx, userId);
      return;
    }

    // Spend or Transfer: source pipe required
    const pipeId = args.from!;
    if (args.paidFrom && pipeId === args.paidFrom) {
      throw new Error("Paid from pipe must be different");
    }
    const pipe = await ctx.db.get(pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    if (args.paidFrom) {
      const paidFromPipe = await ctx.db.get(args.paidFrom);
      if (!paidFromPipe) throw new Error("Paid from pipe not found");
      if (paidFromPipe.userId !== userId) throw new Error("Not authorized");

      const [fromRootId, paidFromRootId] = await Promise.all([
        resolveTopMostAncestor(ctx, pipeId),
        resolveTopMostAncestor(ctx, args.paidFrom),
      ]);
      if (fromRootId === paidFromRootId) {
        throw new Error("Paid from pipe must be outside the transaction tree");
      }

      const fromChildren = await ctx.db
        .query("pipes")
        .withIndex("by_parentId", (q) => q.eq("parentId", pipeId))
        .take(1);
      if (fromChildren.length > 0) {
        throw new Error("Transaction pipe must not have children");
      }

      if (args.value > 0) {
        if (paidFromPipe.parentId) {
          throw new Error("Refund destination must be a root outside the transaction tree");
        }
      } else {
        const paidFromChildren = await ctx.db
          .query("pipes")
          .withIndex("by_parentId", (q) => q.eq("parentId", args.paidFrom!))
          .take(1);
        if (paidFromChildren.length > 0) {
          throw new Error("Paid from pipe must not have children");
        }
      }

      const { from, paidFrom: paidFrom } =
        transactionAccountingEffects(
          { from: pipeId, paidFrom: args.paidFrom },
          args.value,
        );
      await ctx.db.patch(pipeId, {
        fed: pipe.fed + from.fedDelta,
        spent: pipe.spent + from.spentDelta,
      });
      await ctx.db.patch(args.paidFrom, {
        fed: paidFromPipe.fed + paidFrom.fedDelta,
      });
      await recalcPipeSubtree(ctx, args.paidFrom);
      await ctx.db.insert("transactions", {
        title: args.title.toLowerCase(),
        value: args.value,
        date: args.date,
        kind,
        from: pipeId,
        paidFrom: args.paidFrom,
        userId,
      });
      await updateOrCreateTitleUsage(ctx, {
        pipeId,
        userId,
        title: args.title,
        now: usageNow,
      });
      return;
    }

    if (args.to) {
      if (pipeId === args.to)
        throw new Error("Cannot transfer to self");

      const destPipe = await ctx.db.get(args.to);
      if (!destPipe) throw new Error("Destination pipe not found");
      if (destPipe.userId !== userId) throw new Error("Not authorized");

      const { from, to: to } = transactionAccountingEffects(
        { from: pipeId, to: args.to },
        args.value,
      );
      await ctx.db.patch(pipeId, { fed: pipe.fed + from.fedDelta });
      await ctx.db.patch(args.to, {
        fed: destPipe.fed + to.fedDelta,
      });

      if (pipe.rule === "any_spend") {
        await executePipeRule(ctx, pipeId);
      }
    } else {
      const { from } = transactionAccountingEffects(
        { from: pipeId },
        args.value,
      );
      const newSpent = pipe.spent + from.spentDelta;
      await ctx.db.patch(pipeId, {
        spent: newSpent,
      });

      const shouldRunRule =
        pipe.rule === "any_spend" ||
        (pipe.rule === "spend_overflow" && newSpent >= pipe.capacity);
      if (shouldRunRule) {
        await executePipeRule(ctx, pipeId);
      }
    }

    await recascadeTree(ctx, userId);

    await ctx.db.insert("transactions", {
      title: args.title.toLowerCase(),
      value: args.value,
      date: args.date,
      kind,
      from: pipeId,
      to: args.to,
      userId,
    });

    await updateOrCreateTitleUsage(ctx, {
      pipeId,
      userId,
      title: args.title,
      now: usageNow,
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
    if (
      tx.fromIcon !== undefined ||
      tx.toIcon !== undefined ||
      tx.paidFromIcon !== undefined
    ) {
      throw new Error("Transaction is view-only");
    }
    for (const pipeId of new Set([tx.from, tx.to, tx.paidFrom])) {
      if (!pipeId) continue;
      const pipe = await ctx.db.get("pipes", pipeId);
      if (pipe?.deletionJobId) throw new Error("Pipe is being deleted");
    }

    const valueDiff = args.value - tx.value;

    if (valueDiff !== 0) {
      if (tx.from && tx.paidFrom) {
        const fromPipe = await ctx.db.get(tx.from);
        const paidFromPipe = await ctx.db.get(tx.paidFrom);
        if (!fromPipe || !paidFromPipe) throw new Error("Pipe not found");

        if (args.value > 0) {
          if (paidFromPipe.parentId) {
            throw new Error("Refund destination must be a root outside the transaction tree");
          }
        } else {
          const paidFromChildren = await ctx.db
            .query("pipes")
            .withIndex("by_parentId", (q) => q.eq("parentId", tx.paidFrom!))
            .take(1);
          if (paidFromChildren.length > 0) {
            throw new Error("Paid from pipe must not have children");
          }
        }

        const { from, paidFrom: paidFrom } =
          transactionAccountingEffects(
            { from: tx.from, paidFrom: tx.paidFrom },
            valueDiff,
          );
        await ctx.db.patch(tx.from, {
          fed: fromPipe.fed + from.fedDelta,
          spent: fromPipe.spent + from.spentDelta,
        });
        await ctx.db.patch(tx.paidFrom, {
          fed: paidFromPipe.fed + paidFrom.fedDelta,
        });
        await recalcPipeSubtree(ctx, tx.paidFrom);
      } else if (tx.from && tx.to) {
        const src = await ctx.db.get(tx.from);
        const dst = await ctx.db.get(tx.to);
        if (!src || !dst) throw new Error("Pipe not found");

        const { from, to } = transactionAccountingEffects(
          { from: tx.from, to: tx.to },
          valueDiff,
        );
        await ctx.db.patch(tx.from, { fed: src.fed + from.fedDelta });
        await ctx.db.patch(tx.to, { fed: dst.fed + to.fedDelta });
        await recascadeTree(ctx, userId);
      } else if (tx.from) {
        const pipe = await ctx.db.get(tx.from);
        if (!pipe) throw new Error("Pipe not found");

        const { from } = transactionAccountingEffects(
          { from: tx.from },
          valueDiff,
        );
        await ctx.db.patch(tx.from, { spent: pipe.spent + from.spentDelta });
        await recascadeTree(ctx, userId);
      } else if (tx.to) {
        const pipe = await ctx.db.get(tx.to);
        if (!pipe) throw new Error("Pipe not found");

        const { to } = transactionAccountingEffects(
          { to: tx.to },
          valueDiff,
        );
        await ctx.db.patch(tx.to, { fed: pipe.fed + to.fedDelta });
        await recascadeTree(ctx, userId);
      }
    }

    await ctx.db.patch(args.transactionId, {
      title: args.title.toLowerCase(),
      value: args.value,
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
