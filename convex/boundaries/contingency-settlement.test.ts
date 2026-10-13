// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { MAX_AMOUNT } from "../../domain/money";
import schema from "../schema";
import { modules } from "../test.setup";

afterEach(() => vi.useRealTimers());
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 13, 12));
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const donor = await ctx.db.insert("pipes", { userId, parentId: root, name: "Reserve", icon: "shield", priority: 1, capacity: 6000, fed: 6000, spent: 4000 });
    const source = await ctx.db.insert("pipes", { userId, parentId: root, name: "Groceries", icon: "cart-outline", priority: 0,
      capacity: 4000, fed: 4000, spent: 7000, pendingFedAdjustment: 500, contingencyPipeId: donor });
    return { userId, root, source, donor };
  });
  return { t, auth: t.withIdentity({ subject: ids.userId }), ...ids };
}

it("applies coverage once through spent, then settles, and records reciprocal source/donor snapshots", async () => {
  const { t, auth, source, donor } = await setup();
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ spent: 0, fed: -500, capacity: 4000, pendingFedAdjustment: 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 6000, fed: 6000 });
  const [event] = await auth.query(api.events.latest, { pipeId: source });
  if (event.type !== "settlement") throw new Error("Expected settlement");
  const [mirror] = await auth.query(api.events.latest, { pipeId: donor });
  expect(event).toMatchObject({ type: "settlement", before: { spent: 7000, fed: 4000 }, after: { spent: 0, fed: -500 },
    coverage: { amountCents: 2000, pipeId: donor, name: "Reserve", icon: "shield", before: { spent: 4000, fed: 6000 }, after: { spent: 6000, fed: 6000 } } });
  expect(mirror).toMatchObject({ type: "settlement_coverage", operationId: event.id, pipeId: donor, before: { spent: 4000 }, after: { spent: 6000 },
    coverage: { amountCents: 2000, pipeId: source, name: "Groceries", before: event.before, after: event.after } });
  expect((await auth.query(api.events.latest, {})).filter(entry => entry.operationId === event.id)).toHaveLength(2);
});

it.each(["manual", "cron"] as const)("records aggregate coverage beyond the transaction limit during %s settlement", async cause => {
  const { t, auth, userId, source, donor } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch("pipes", source, { capacity: -MAX_AMOUNT, spent: MAX_AMOUNT, fed: 0, pendingFedAdjustment: 0,
      ...(cause === "cron" ? { rule: "cron", cronNextDate: Date.now() - 86400000, cronInterval: { interval: 1, unit: "days" } } : {}) });
    await ctx.db.patch("pipes", donor, { capacity: MAX_AMOUNT, fed: MAX_AMOUNT, spent: -MAX_AMOUNT });
  });
  const total = () => t.run(async ctx => (await ctx.db.query("pipes").withIndex("by_userId", q => q.eq("userId", userId)).collect())
    .reduce((sum, pipe) => sum + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent, 0));
  const before = await total();
  if (cause === "manual") await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  else await t.mutation(internal.pipes.runDueCronRules, { now: Date.now() });
  const [event] = await auth.query(api.events.latest, { pipeId: source });
  const [mirror] = await auth.query(api.events.latest, { pipeId: donor });
  expect(event).toMatchObject({ type: "settlement", cause, after: { fed: MAX_AMOUNT, spent: 0 },
    coverage: { amountCents: 2 * MAX_AMOUNT, before: { spent: -MAX_AMOUNT }, after: { spent: MAX_AMOUNT } } });
  expect(mirror).toMatchObject({ type: "settlement_coverage", operationId: event.operationId, coverage: { amountCents: 2 * MAX_AMOUNT } });
  expect(await total()).toBe(before);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("conserves total settled funding and preserves the source's original expense attribution", async () => {
  const { t, auth, source, donor } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { spent: 0 }));
  await auth.mutation(api.financialOperations.create, { from: source, title: "Groceries", value: -7000, date: Date.now() });
  const before = await auth.query(api.pipes.getPipes, {});
  const total = (pipes: typeof before) => pipes.filter(pipe => pipe._id === source || pipe._id === donor)
    .reduce((sum, pipe) => sum + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent, 0);
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  expect(total(await auth.query(api.pipes.getPipes, {}))).toBe(total(before));
  const report = await auth.query(api.monthlySpendingStats.eventMonthPage, {
    periodStart: Date.UTC(2026, 9, 1), paginationOpts: { numItems: 100, cursor: null },
  });
  expect(report.page[0].summary).toMatchObject({ grossSpendingCents: 7000, spendingTransactionCount: 1 });
  expect(report.page[0].pipeSpending).toHaveLength(1);
  expect(await auth.query(api.events.latest, { pipeId: donor })).toHaveLength(1);
});

it.each([
  { capacity: -3000, spent: 0, donorFed: 5000, donorSpent: 1000, amount: 3000, expectedFed: 7500 },
  { capacity: 4000, spent: 4000, donorFed: 6000, donorSpent: 4000, amount: 0, expectedFed: 500 },
  { capacity: 4000, spent: 7000, donorFed: 2000, donorSpent: 4000, amount: 0, expectedFed: -2500 },
])("covers $amount cents for capacity=$capacity and spent=$spent", async row => {
  const { t, auth, source, donor } = await setup();
  await t.run(async ctx => {
    await ctx.db.patch("pipes", source, { capacity: row.capacity, spent: row.spent });
    await ctx.db.patch("pipes", donor, { fed: row.donorFed, spent: row.donorSpent, pendingFedAdjustment: 9000 });
  });
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  const [event] = await auth.query(api.events.latest, { pipeId: source });
  expect(event).toMatchObject({ after: { fed: row.expectedFed } });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: row.donorSpent + row.amount });
  expect(await auth.query(api.events.latest, { pipeId: donor })).toHaveLength(row.amount ? 1 : 0);
});

it("covers overflow before computing the capacity update, without changing the backdated expense", async () => {
  const { t, auth, source, donor } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule: "spend_overflow", capUpdateValue: 4000, spent: 0 }));
  const date = Date.now() - 86400000;
  await auth.mutation(api.financialOperations.create, { from: source, title: "Groceries", value: -7000, date });
  const events = await auth.query(api.events.latest, { pipeId: source });
  expect(events.find(event => event.type === "settlement")).toMatchObject({ cause: "spend_overflow", occurredAt: Date.now(),
    before: { spent: 7000 }, after: { capacity: 3000, fed: -500 }, coverage: { amountCents: 2000 } });
  expect(events.find(event => event.type === "transaction")).toMatchObject({ value: -7000, occurredAt: date });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 6000 });
});

it("does not reclaim permanent coverage after a refund", async () => {
  const { t, auth, source, donor } = await setup();
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  await auth.mutation(api.financialOperations.create, { from: source, title: "Refund", value: 500, date: Date.now() });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 6000 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ spent: -500 });
});

it.each([false, true])("preserves or removes the entire coverage operation when deleting the donor (discard: %s)", async deleteTransactions => {
  const { t, auth, source, donor } = await setup();
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  const [event] = await auth.query(api.events.latest, { pipeId: source });
  await auth.mutation(api.pipes.startPipeDeletion, { pipeId: donor, deleteTransactions });
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const history = await auth.query(api.events.latest, {});
  expect(history.filter(entry => entry.operationId === event.operationId)).toHaveLength(deleteTransactions ? 0 : 2);
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ spent: 0, fed: -500 });
});

it("keeps both coverage perspectives outside expense actions and corrections", async () => {
  const { auth, source, donor } = await setup();
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  for (const pipeId of [source, donor]) {
    const [event] = await auth.query(api.events.latest, { pipeId });
    expect(await auth.query(api.financialOperations.get, { operationId: event.operationId })).toBeNull();
    await expect(auth.mutation(api.financialOperations.remove, { operationId: event.operationId })).rejects.toMatchObject({ data: { code: "OPERATION_NOT_FOUND" } });
    await expect(auth.query(api.operationCorrections.list, { operationId: event.operationId, paginationOpts: { numItems: 20, cursor: null } }))
      .rejects.toMatchObject({ data: { code: "OPERATION_NOT_FOUND" } });
  }
});

it("rolls back source, donor, and events if the affected accounting tree is frozen", async () => {
  const { t, auth, source, donor } = await setup();
  await auth.mutation(api.pipes.startPipeDeletion, { pipeId: donor, deleteTransactions: false });
  const before = await t.run(async ctx => [await ctx.db.get("pipes", source), await ctx.db.get("pipes", donor)]);
  await expect(auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source })).rejects.toThrow();
  expect(await t.run(async ctx => [await ctx.db.get("pipes", source), await ctx.db.get("pipes", donor)])).toEqual(before);
  expect(await auth.query(api.events.latest, { pipeId: source })).toEqual([]);
  await t.finishAllScheduledFunctions(vi.runAllTimers);
});

it("revalidates a persisted target at settlement instead of following a contingency chain", async () => {
  const { t, auth, source, donor } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", donor, { contingencyPipeId: source }));
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  const [event] = await auth.query(api.events.latest, { pipeId: source });
  expect(event).not.toHaveProperty("coverage");
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 4000 });
});

it("never covers an instant-settlement source, including explicit execution of a stale selection", async () => {
  const { t, auth, source, donor } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule: "instant_settlement", spent: 0 }));
  await auth.mutation(api.financialOperations.create, { from: source, title: "Groceries", value: -7000, date: Date.now() });
  expect((await auth.query(api.events.latest, { pipeId: source })).map(entry => entry.type)).toEqual(["transaction"]);
  await auth.mutation(api.pipes.executePipeRuleNow, { pipeId: source });
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 4000 });
  expect(await auth.query(api.events.latest, { pipeId: donor })).toEqual([]);
});

it("applies all net structural-edit deltas before coverage so a donor refund cannot overwrite it", async () => {
  const { t, auth, source, donor } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule: "spend_overflow", spent: 5500 }));
  await auth.mutation(api.financialOperations.create, { from: source, title: "Refund", value: 2000, date: Date.now() });
  const operationId = (await auth.query(api.events.latest, { pipeId: source })).find(event => event.type === "transaction")!.operationId;
  const total = async () => {
    const pipes = await auth.query(api.pipes.getPipes, {});
    return pipes.filter(pipe => pipe._id === source || pipe._id === donor)
      .reduce((sum, pipe) => sum + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent, 0);
  };
  const before = await total();
  await auth.mutation(api.financialOperations.edit, { operationId, title: "Refund", value: 2000, date: Date.now(), primaryPipeId: donor, target: { type: "expense" } });
  expect(await total()).toBe(before);
  expect(await t.run(ctx => ctx.db.get("pipes", donor))).toMatchObject({ spent: 3500, fed: 6000 });
  expect((await auth.query(api.events.latest, { pipeId: source })).find(event => event.type === "settlement"))
    .toMatchObject({ coverage: { amountCents: 1500, before: { spent: 2000 }, after: { spent: 3500 } } });
});
