// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { register } from "@convex-dev/migrations/test";
import { afterEach, expect, it, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { internal } from "../_generated/api";

afterEach(() => vi.useRealTimers());

it("normalizes root rules without settlement, money changes, or changes to inner rules", async () => {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  register(t);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "owner", email: "owner@example.com", password: "hash" });
    const values = {
      userId,
      icon: "pipe",
      priority: 0,
      capacity: 500,
      fed: 400,
      spent: 300,
      pendingFedAdjustment: 100,
      rule: "cron" as const,
      capUpdateValue: 100,
      cronNextDate: 1000,
      cronInterval: { interval: 1, unit: "days" as const },
    };
    const feed = await ctx.db.insert("pipes", { ...values, name: "Feed" });
    const boiler = await ctx.db.insert("pipes", { ...values, name: "Boiler", sourceType: "boiler", contributedFed: 700 });
    const parent = await ctx.db.insert("pipes", { ...values, name: "Parent" });
    const child = await ctx.db.insert("pipes", { ...values, name: "Child", parentId: parent });
    return { feed, boiler, parent, child };
  });
  const before = await t.run(ctx => ctx.db.query("pipes").collect());
  await t.mutation(internal.migrations.m20261025NormalizeRootRules, { dryRun: false });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const after = await t.run(ctx => ctx.db.query("pipes").collect());
  for (const pipe of after) {
    const old = before.find(item => item._id === pipe._id)!;
    expect(pipe).toMatchObject({ capacity: old.capacity, fed: old.fed, spent: old.spent, pendingFedAdjustment: old.pendingFedAdjustment });
    if (pipe._id === ids.child) expect(pipe).toEqual(old);
    else {
      expect(pipe.rule).toBe(pipe._id === ids.parent ? undefined : "instant_settlement");
      expect(pipe.capUpdateValue).toBeUndefined();
      expect(pipe.cronNextDate).toBeUndefined();
      expect(pipe.cronInterval).toBeUndefined();
    }
  }
  expect(after.find(pipe => pipe._id === ids.boiler)?.contributedFed).toBe(700);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  await t.mutation(internal.migrations.m20261025NormalizeRootRules, { dryRun: false });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  expect(await t.run(ctx => ctx.db.query("pipes").collect())).toEqual(after);
});
