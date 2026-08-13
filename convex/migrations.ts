import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api.js";
import { DataModel } from "./_generated/dataModel.js";
import { migrateNumberToCents, migratePipeForest } from "../domain/money";
import { internal } from "./_generated/api";
import { MONEY_MIGRATION_VERSION } from "./lib/constants";

export const migrations = new Migrations<DataModel>(components.migrations);

export const migrateTransactionsToCents = migrations.define({
  table: "transactions",
  batchSize: 100,
  migrateOne: (ctx, transaction) => {
    if (transaction.moneyMigrationVersion === MONEY_MIGRATION_VERSION) return;
    return {
      value: migrateNumberToCents(transaction.value),
      moneyMigrationVersion: MONEY_MIGRATION_VERSION,
    };
  },
});

export const migratePipesToCents = migrations.define({
  table: "users",
  batchSize: 10,
  migrateOne: async (ctx, user) => {
    if (user.moneyMigrationVersion === MONEY_MIGRATION_VERSION) return;

    const jobs = await ctx.db
      .query("pipeDeletionJobs")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    if (jobs.some((job) => job.phase !== "complete")) {
      throw new Error("Cannot migrate money while a pipe deletion job is active");
    }

    const pipes = await ctx.db
      .query("pipes")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    const migratedPipes = migratePipeForest(
      pipes.map((pipe) => ({
        id: pipe._id,
        parentId: pipe.parentId,
        fed: pipe.fed,
        capacity: pipe.capacity,
        spent: pipe.spent,
        capUpdateValue: pipe.capUpdateValue,
        alreadyCents: pipe.moneyMigrationVersion === MONEY_MIGRATION_VERSION,
      })),
    );
    const migratedById = new Map(migratedPipes.map((pipe) => [pipe.id, pipe]));

    for (const pipe of pipes) {
      if (pipe.moneyMigrationVersion === MONEY_MIGRATION_VERSION) continue;
      const migrated = migratedById.get(pipe._id)!;
      await ctx.db.patch("pipes", pipe._id, {
        capacity: migrated.capacityCents,
        fed: migrated.fedCents,
        spent: migrated.spentCents,
        capUpdateValue: migrated.capUpdateValueCents,
        moneyMigrationVersion: MONEY_MIGRATION_VERSION,
      });
    }

    await ctx.db.patch("users", user._id, {
      moneyMigrationVersion: MONEY_MIGRATION_VERSION,
    });
  },
});

export const runMoneyMigration = migrations.runner([
  internal.migrations.migrateTransactionsToCents,
  internal.migrations.migratePipesToCents,
]);
