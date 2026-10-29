import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

// One-off data migrations. Keep exported names and paths stable once started.
// Remove a migration and its dedicated test only after it has completed in every
// supported deployment and no running migration references it. Regenerate the
// Convex API types after removal; do not delete the component's migration records.
const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Makes childless roots Instant-only and roots with children ruleless, clearing
 * incompatible rule options and root contingency. Leaves money and inner pipes
 * unchanged. Finish active root deletion jobs before running.
 *
 * Dry run: bunx convex run migrations:m20261025NormalizeRootRules '{"dryRun":true}'
 * Apply:   bunx convex run migrations:m20261025NormalizeRootRules '{"dryRun":false}'
 */
export const m20261025NormalizeRootRules = migrations.define({
  table: "pipes",
  batchSize: 50,
  migrateOne: async (ctx, pipe) => {
    if (pipe.parentId) return;
    if (pipe.deletionJobId) throw new Error("Finish pipe deletion before normalizing root rules");
    const child = await ctx.db.query("pipes").withIndex("by_parentId", q => q.eq("parentId", pipe._id)).first();
    const rule = child ? undefined : "instant_settlement";
    if (pipe.rule === rule && pipe.capUpdateValue === undefined && pipe.cronNextDate === undefined &&
      pipe.cronInterval === undefined && pipe.contingencyPipeId === undefined) return;
    await ctx.db.patch("pipes", pipe._id, {
      rule,
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
      contingencyPipeId: undefined,
    });
  },
});
