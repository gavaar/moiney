import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { transactionStructureFromRoles } from "../domain/transactions";
import { insertFinancialOperation } from "./lib/events/financial";
import { readHistoryOperation } from "./lib/events/persistence";
import { ensurePipeDeletionHistory, syncPipeCreationHistory } from "./lib/events/lifecycle";
import { ensurePipeCreationEvent } from "./lib/pipeHistory";

export const migrations = new Migrations<DataModel>(components.migrations);

export const m20261006_160000_backfillLivePipeEvents = migrations.define({
  table: "pipes",
  batchSize: 10,
  migrateOne: async (ctx, pipe) => {
    await ensurePipeCreationEvent(ctx, pipe);
  },
});

export const m20261006_160001_backfillLifecycleEvents = migrations.define({
  table: "pipeCreationEvents",
  batchSize: 25,
  migrateOne: async (ctx, snapshot) => {
    const pipe = await ctx.db.get("pipes", snapshot.pipeId);
    if (pipe) {
      if (pipe.userId !== snapshot.userId) throw new Error("Invalid pipe history owner");
      await ensurePipeCreationEvent(ctx, pipe);
      return;
    }
    await syncPipeCreationHistory(ctx, snapshot);
    let deletedAt = snapshot.deletedAt;
    if (deletedAt === undefined) {
      // Three indexed point reads, never a scan of an archive's entire history.
      const newest = await Promise.all([
        ctx.db.query("transactions").withIndex("by_userId_from_date", q => q.eq("userId", snapshot.userId).eq("from", snapshot.pipeId)).order("desc").first(),
        ctx.db.query("transactions").withIndex("by_userId_to_date", q => q.eq("userId", snapshot.userId).eq("to", snapshot.pipeId)).order("desc").first(),
        ctx.db.query("transactions").withIndex("by_userId_paidFrom_date", q => q.eq("userId", snapshot.userId).eq("paidFrom", snapshot.pipeId)).order("desc").first(),
      ]);
      deletedAt = Math.max(snapshot.occurredAt, ...newest.map(row => row?.date ?? snapshot.occurredAt));
      await ctx.db.patch("pipeCreationEvents", snapshot._id, { deletedAt });
    }
    await ensurePipeDeletionHistory(ctx, snapshot, deletedAt);
  },
});

export const m20261006_160002_backfillTransactionEvents = migrations.define({
  table: "transactions",
  batchSize: 50,
  migrateOne: async (ctx, transaction) => {
    if (transaction.operationId) {
      const operation = await readHistoryOperation(ctx, transaction.userId, transaction.operationId);
      if (!operation || operation.canonicalEvent.id !== transaction.operationId) {
        throw new Error("History operation not found");
      }
      return;
    }
    const operationId = await insertFinancialOperation(ctx, {
      userId: transaction.userId,
      title: transaction.title,
      value: transaction.value,
      occurredAt: transaction.date,
      structure: transactionStructureFromRoles(transaction),
    });
    await ctx.db.patch("transactions", transaction._id, { operationId });
  },
});
