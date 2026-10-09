import { Migrations } from "@convex-dev/migrations";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { internalQuery } from "./_generated/server";
import { inspectCorrectionOperationLink } from "./lib/events/correctionOwnership";

export const migrations = new Migrations<DataModel>(components.migrations);

export const auditCorrectionOperationLinks = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(v.object({
    correctionId: v.id("transactionCorrections"),
    transactionId: v.optional(v.id("transactions")),
    operationId: v.optional(v.id("events")),
    status: v.union(v.literal("ready"), v.literal("linked"), v.literal("missing_transaction"),
      v.literal("foreign_transaction"), v.literal("missing_operation_link"), v.literal("conflicting_operation_link"),
      v.literal("missing_or_foreign_operation"), v.literal("invalid_operation")),
  })),
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.paginationOpts.numItems) || args.paginationOpts.numItems < 1 || args.paginationOpts.numItems > 100) {
      throw new Error("Invalid audit page size");
    }
    if (args.paginationOpts.endCursor != null) throw new Error("Audit end cursors are not supported");
    const page = await ctx.db.query("transactionCorrections").paginate({
      numItems: args.paginationOpts.numItems,
      cursor: args.paginationOpts.cursor,
    });
    return { ...page, page: await Promise.all(page.page.map(async correction => ({
      correctionId: correction._id,
      transactionId: correction.transactionId,
      ...await inspectCorrectionOperationLink(ctx, correction),
    }))) };
  },
});

export const m20261008_180000_backfillCorrectionOperationIds = migrations.define({
  table: "transactionCorrections",
  batchSize: 25,
  migrateOne: async (ctx, correction) => {
    const link = await inspectCorrectionOperationLink(ctx, correction);
    if (!("operationId" in link)) {
      throw new Error(`Correction ${correction._id} requires review: ${link.status}`);
    }
    if (link.status === "ready") {
      await ctx.db.patch("transactionCorrections", correction._id, { operationId: link.operationId });
    }
  },
});

export const m20261009_160000_detachCorrectionTransactionIds = migrations.define({
  table: "transactionCorrections",
  batchSize: 25,
  migrateOne: async (ctx, correction) => {
    const link = await inspectCorrectionOperationLink(ctx, correction);
    if (link.status !== "linked") {
      throw new Error(`Correction ${correction._id} requires review: ${link.status}`);
    }
    if (correction.transactionId !== undefined) {
      await ctx.db.patch("transactionCorrections", correction._id, { transactionId: undefined });
    }
  },
});

export const m20261009_160001_purgeLegacyTransactions = migrations.define({
  table: "transactions",
  batchSize: 25,
  migrateOne: async (ctx, transaction) => {
    const correction = await ctx.db.query("transactionCorrections")
      .withIndex("by_transactionId", q => q.eq("transactionId", transaction._id)).first();
    if (correction) throw new Error(`Transaction ${transaction._id} still has correction links`);
    await ctx.db.delete("transactions", transaction._id);
  },
});

export const m20261009_160002_purgeLegacyPipeCreationEvents = migrations.define({
  table: "pipeCreationEvents",
  batchSize: 25,
  migrateOne: async (ctx, snapshot) => {
    await ctx.db.delete("pipeCreationEvents", snapshot._id);
  },
});

/** Storage-only checkpoint; the full correction audit remains a separate prerequisite. */
export const legacyRetirementStatus = internalQuery({
  args: {},
  returns: v.object({ transactionsRemain: v.boolean(), lifecycleRowsRemain: v.boolean(), correctionTransactionLinksRemain: v.boolean() }),
  handler: async ctx => {
    const [transaction, lifecycle, correction] = await Promise.all([
      ctx.db.query("transactions").first(),
      ctx.db.query("pipeCreationEvents").first(),
      ctx.db.query("transactionCorrections").withIndex("by_transactionId").order("desc").first(),
    ]);
    return { transactionsRemain: transaction !== null, lifecycleRowsRemain: lifecycle !== null,
      correctionTransactionLinksRemain: correction?.transactionId !== undefined };
  },
});
