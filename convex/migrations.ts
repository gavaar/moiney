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
    transactionId: v.id("transactions"),
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
