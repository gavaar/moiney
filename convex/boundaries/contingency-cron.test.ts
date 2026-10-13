// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

afterEach(() => vi.useRealTimers());
const occurrence = Date.UTC(2026, 9, 1, 5);
const now = Date.UTC(2026, 9, 13, 12);
async function setup(demands = [1000, 1000, 1000], available = 800) {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const donor = await ctx.db.insert("pipes", { userId, parentId: root, name: "Reserve", icon: "shield", priority: 1, capacity: available,
      fed: available + 200, spent: 200 });
    const sources: Id<"pipes">[] = [];
    for (const demand of demands) sources.push(await ctx.db.insert("pipes", {
      userId, parentId: root, name: `Source ${sources.length}`, icon: "pipe", priority: 0, capacity: 4000, fed: 4000,
      spent: 4000 + demand, contingencyPipeId: donor, rule: "cron", capUpdateValue: 4000,
      cronNextDate: occurrence, cronInterval: { interval: 1, unit: "months" },
    }));
    return { userId, root, donor, sources };
  });
  return { t, auth: t.withIdentity({ subject: ids.userId }), ...ids };
}

it("shares one occurrence/priority equally across all claims, even when the trigger contains only one claimant", async () => {
  const { t, auth, donor, sources } = await setup();
  await t.mutation(internal.pipes.runDueCronRules, { now, pendingPipeIds: [sources[2]] });
  const amounts: number[] = [];
  for (const pipeId of [...sources].sort()) {
    const [event] = await auth.query(api.events.latest, { pipeId });
    expect(event).toMatchObject({ type: "settlement", cause: "cron", before: { spent: 5000 } });
    if (event.type !== "settlement") throw new Error("Expected settlement");
    amounts.push(event.coverage?.amountCents ?? 0);
  }
  expect(amounts).toEqual([267, 267, 266]);
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 1000 });
  expect(await auth.query(api.events.latest, { pipeId: donor })).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: "settlement_coverage", before: expect.objectContaining({ fed: 1000 }), after: expect.objectContaining({ fed: 1000 }) }),
  ]));
  const beforeRetry = await auth.query(api.events.latest, {});
  await t.mutation(internal.pipes.runDueCronRules, { now, pendingPipeIds: [...sources].reverse() });
  expect(await auth.query(api.events.latest, {})).toEqual(beforeRetry);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it.each([
  { demands: [100, 1000, 1000], budget: 1000, expected: [100, 450, 450] },
  { demands: [1, 2, 100], budget: 12, expected: [1, 2, 9] },
  { demands: [100, 200, 0], budget: 1000, expected: [100, 200, 0] },
])("caps and redistributes demands $demands within $budget cents", async row => {
  const { t, auth, donor, sources } = await setup(row.demands, row.budget);
  const before = await t.run(async ctx => (await ctx.db.query("pipes").collect())
    .reduce((sum, pipe) => sum + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent, 0));
  await t.mutation(internal.pipes.runDueCronRules, { now, pendingPipeIds: [...sources].reverse() });
  const amounts = await Promise.all(sources.map(async pipeId => {
    const [event] = await auth.query(api.events.latest, { pipeId });
    if (event.type !== "settlement") throw new Error("Expected settlement");
    return event.coverage?.amountCents ?? 0;
  }));
  expect(amounts).toEqual(row.expected);
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 200 + row.expected.reduce((a, b) => a + b, 0) });
  expect(await t.run(async ctx => (await ctx.db.query("pipes").collect())
    .reduce((sum, pipe) => sum + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent, 0))).toBe(before);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("does not pool different priorities or occurrences, spending earlier groups' liquidity first", async () => {
  const { t, auth, sources } = await setup([1000, 1000, 1000], 1600);
  await t.run(async ctx => {
    await ctx.db.patch("pipes", sources[0], { cronNextDate: occurrence - 86400000, priority: 10 });
    await ctx.db.patch("pipes", sources[1], { priority: 0 });
    await ctx.db.patch("pipes", sources[2], { priority: 1 });
  });
  await t.mutation(internal.pipes.runDueCronRules, { now });
  for (const [index, amount] of [1000, 600, 0].entries()) {
    const [event] = await auth.query(api.events.latest, { pipeId: sources[index] });
    if (event.type !== "settlement") throw new Error("Expected settlement");
    expect(event.coverage?.amountCents ?? 0).toBe(amount);
  }
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("covers historical debt on an overdue run once while preserving accumulated capacity updates", async () => {
  const { t, auth, donor, sources } = await setup([0], 3000);
  await t.run(ctx => ctx.db.patch("pipes", sources[0], { capacity: -3000, spent: 0, fed: 0, cronNextDate: Date.UTC(2026, 7, 1, 5), capUpdateValue: 1000 }));
  await t.mutation(internal.pipes.runDueCronRules, { now });
  const [event] = await auth.query(api.events.latest, { pipeId: sources[0] });
  expect(event).toMatchObject({ coverage: { amountCents: 3000 }, before: { capacity: -3000, spent: 0 }, after: { capacity: 3000, spent: 0, fed: 3000 } });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 3200 });
  const history = await auth.query(api.events.latest, {});
  await t.mutation(internal.pipes.runDueCronRules, { now });
  expect(await auth.query(api.events.latest, {})).toEqual(history);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("applies same-group donor spending before executing a donor's own scheduled rule", async () => {
  const { t, auth, donor, sources } = await setup([1000, 1000], 1000);
  await t.run(ctx => ctx.db.patch("pipes", donor, { priority: 0, rule: "cron", cronNextDate: occurrence, cronInterval: { interval: 1, unit: "months" } }));
  await t.mutation(internal.pipes.runDueCronRules, { now });
  const donorEvents = await auth.query(api.events.latest, { pipeId: donor });
  expect(donorEvents.find(event => event.type === "settlement")).toMatchObject({ before: { fed: 1200, spent: 1200 }, after: { fed: 0, spent: 0 } });
  expect(donorEvents.filter(event => event.type === "settlement_coverage")).toHaveLength(2);
  for (const pipeId of sources) expect((await auth.query(api.events.latest, { pipeId }))[0]).toMatchObject({ coverage: { amountCents: 500 } });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("skips frozen trees entirely and executes their scheduled coverage after deletion completes", async () => {
  const { t, auth, userId, root, donor, sources } = await setup([1000], 1000);
  const sibling = await t.run(ctx => ctx.db.insert("pipes", { userId, parentId: root, name: "Deleting", icon: "pipe", priority: 0, capacity: 0, fed: 0, spent: 0 }));
  await auth.mutation(api.pipes.startPipeDeletion, { pipeId: sibling, deleteTransactions: false });
  const before = await t.run(async ctx => [await ctx.db.get("pipes", sources[0]), await ctx.db.get("pipes", donor)]);
  await t.mutation(internal.pipes.runDueCronRules, { now });
  expect(await auth.query(api.events.latest, { pipeId: sources[0] })).toEqual([]);
  expect(await t.run(async ctx => [await ctx.db.get("pipes", sources[0]), await ctx.db.get("pipes", donor)])).toEqual(before);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const survivingDonor = await t.run(ctx => ctx.db.get("pipes", donor));
  await t.mutation(internal.pipes.runDueCronRules, { now });
  expect((await auth.query(api.events.latest, { pipeId: sources[0] }))[0]).toMatchObject({ coverage: { amountCents: survivingDonor!.fed - survivingDonor!.spent } });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("keeps equal sharing intact across a real 500-candidate query-page boundary", async () => {
  const { t, auth, sources } = await setup();
  await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Other root", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    for (let index = 0; index < 499; index++) await ctx.db.insert("pipes", { userId, parentId: root, name: "Other due", icon: "pipe", priority: 0,
      capacity: 0, fed: 0, spent: 0, rule: "cron", cronNextDate: occurrence - 86400000, cronInterval: { interval: 1, unit: "months" } });
  });
  await t.mutation(internal.pipes.runDueCronRules, { now });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const amounts = await Promise.all([...sources].sort().map(async pipeId => {
    const events = await auth.query(api.events.latest, { pipeId });
    expect(events).toHaveLength(1);
    const [event] = events;
    if (event.type !== "settlement") throw new Error("Expected settlement");
    return event.coverage?.amountCents ?? 0;
  }));
  expect(amounts).toEqual([267, 267, 266]);
});

it("uses liquidity released by a donor's earlier settlement, without pooling the different occurrences", async () => {
  const { t, auth, donor, sources } = await setup([1000, 1000], 600);
  await t.run(ctx => ctx.db.patch("pipes", donor, { rule: "cron", cronNextDate: occurrence - 86400000,
    cronInterval: { interval: 1, unit: "months" }, pendingFedAdjustment: 1000 }));
  await t.mutation(internal.pipes.runDueCronRules, { now });
  const donorEvents = await auth.query(api.events.latest, { pipeId: donor });
  expect(donorEvents.find(event => event.type === "settlement")).toMatchObject({ before: { fed: 800, spent: 200, pendingFedAdjustment: 1000 },
    after: { fed: 1600, spent: 0, pendingFedAdjustment: 0 } });
  for (const pipeId of sources) expect((await auth.query(api.events.latest, { pipeId }))[0]).toMatchObject({
    coverage: { amountCents: 800, before: { fed: 1600 }, after: { fed: 1600 } },
  });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("executes another root's coverage while a tree in the same account is frozen", async () => {
  const { t, auth, userId, root, donor, sources } = await setup([1000], 1000);
  const other = await t.run(async ctx => {
    const rootId = await ctx.db.insert("pipes", { userId, name: "Other", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const donorId = await ctx.db.insert("pipes", { userId, parentId: rootId, name: "Other donor", icon: "shield", priority: 1, capacity: 1000, fed: 1000, spent: 0 });
    return await ctx.db.insert("pipes", { userId, parentId: rootId, name: "Other source", icon: "pipe", priority: 0,
      capacity: 4000, fed: 4000, spent: 5000, rule: "cron", cronNextDate: occurrence,
      cronInterval: { interval: 1, unit: "months" }, contingencyPipeId: donorId });
  });
  await auth.mutation(api.pipes.startPipeDeletion, { pipeId: root, deleteTransactions: false });
  const before = await t.run(async ctx => [await ctx.db.get("pipes", sources[0]), await ctx.db.get("pipes", donor)]);
  await t.mutation(internal.pipes.runDueCronRules, { now });
  expect(await t.run(async ctx => [await ctx.db.get("pipes", sources[0]), await ctx.db.get("pipes", donor)])).toEqual(before);
  expect((await auth.query(api.events.latest, { pipeId: other }))[0]).toMatchObject({ coverage: { amountCents: 1000 } });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("defers a fifth maximum-size account, then completes without duplicate coverage", async () => {
  const { t, userId, root, sources } = await setup([1000], 1000);
  const accounts = await t.run(async ctx => {
    for (let i = 0; i < 497; i++) await ctx.db.insert("pipes", { userId, parentId: root, name: "Unused", icon: "pipe", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const result = [{ userId, source: sources[0] }];
    for (let account = 1; account < 5; account++) {
      const owner = await ctx.db.insert("users", { username: `owner-${account}`, email: `${account}@example.com`, password: "hash" });
      const parentId = await ctx.db.insert("pipes", { userId: owner, name: "Root", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const donorId = await ctx.db.insert("pipes", { userId: owner, parentId, name: "Donor", icon: "shield", priority: 1, capacity: 1000, fed: 1000, spent: 0 });
      const sourceId = await ctx.db.insert("pipes", { userId: owner, parentId, name: "Source", icon: "pipe", priority: 0, capacity: 4000, fed: 4000, spent: 5000,
        contingencyPipeId: donorId, rule: "cron", cronNextDate: occurrence, cronInterval: { interval: 1, unit: "months" } });
      for (let i = 0; i < 497; i++) await ctx.db.insert("pipes", { userId: owner, parentId, name: "Unused", icon: "pipe", priority: 0, capacity: 0, fed: 0, spent: 0 });
      result.push({ userId: owner, source: sourceId });
    }
    return result;
  });
  await t.mutation(internal.pipes.runDueCronRules, { now });
  for (const [index, account] of accounts.entries()) {
    expect(await t.withIdentity({ subject: account.userId }).query(api.events.latest, { pipeId: account.source })).toHaveLength(index < 4 ? 1 : 0);
  }
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  for (const account of accounts) {
    const history = await t.withIdentity({ subject: account.userId }).query(api.events.latest, { pipeId: account.source });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ coverage: { amountCents: 1000 } });
  }
});
