// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers();
  const now = Date.UTC(2026, 9, 13, 12);
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const { userId, pipeId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", {
      userId,
      name: "Coffee",
      icon: "cafe",
      priority: 0,
      capacity: 4000,
      fed: 4000,
      spent: 3000,
      pendingFedAdjustment: 500,
      rule: "cron",
      capUpdateValue: 4000,
      cronNextDate: Date.UTC(2026, 10, 1, 5),
      cronInterval: { interval: 1, unit: "months" },
    });
    return { userId, pipeId };
  });
  return { t, now, userId, pipeId, auth: t.withIdentity({ subject: userId }) };
}

describe("Convex boundaries: settlement history", () => {
  it("includes settlement rows in ordinary history queries without a client opt-in", async () => {
    const { auth, pipeId } = await setup();
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const history = await auth.query(api.events.latest, { pipeId });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ type: "settlement", pipeId, cause: "manual" });
    expect((await auth.query(api.events.list, { pipeId })).events).toEqual(history);
  });

  it.each([false, true])("paginates the canonical stream through a settlement-only window (pipe scope: %s)", async scoped => {
    const { auth, pipeId, now } = await setup();
    await auth.mutation(api.financialOperations.create, { from: pipeId, title: "older coffee", value: -100, date: now - 86400000 });
    for (let index = 0; index < 31; index++) await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const scope = scoped ? { pipeId } : {};
    const page = await auth.query(api.events.list, { ...scope, limit: 30 });
    expect(page.events).toHaveLength(30);
    expect(page.events.every(event => event.type === "settlement")).toBe(true);
    expect(page.isDone).toBe(false);
    expect(await auth.query(api.events.latest, scope)).toEqual(page.events);
    const tail = await auth.query(api.events.list, { ...scope, limit: 30, cursor: page.cursor! });
    expect(tail.events).toHaveLength(2);
    expect(tail.events[0]).toMatchObject({ type: "settlement" });
    expect(tail.events[1]).toMatchObject({ type: "transaction", title: "older coffee" });
    expect(tail.isDone).toBe(true);
    expect(tail.cursor).toBeNull();
    expect(new Set([...page.events, ...tail.events].map(event => event.id)).size).toBe(32);
  });
  it("records manual execution of a configured rule as a read-only settlement with exact snapshots", async () => {
    const { t, auth, pipeId, now } = await setup();
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const history = await auth.query(api.events.latest, { pipeId });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: "settlement",
      cause: "manual",
      pipeId,
      occurredAt: now,
      name: "Coffee",
      icon: "cafe",
      before: { capacity: 4000, fed: 4000, spent: 3000, pendingFedAdjustment: 500 },
      after: { capacity: 5000, fed: 1500, spent: 0, pendingFedAdjustment: 0 },
    });
    expect(history[0].operationId).toBe(history[0].id);
    expect(history[0]).not.toHaveProperty("value");
    expect(history[0]).not.toHaveProperty("title");
    expect(history[0]).not.toHaveProperty("editedAt");
    expect(history[0]).not.toHaveProperty("isSettlement");
    expect(history[0]).not.toHaveProperty("rule");
    expect(await t.run(ctx => ctx.db.get("events", history[0].id))).not.toHaveProperty("rule");
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ rule: "cron", fed: 1500, capacity: 5000 });
  });

  it.each(["manual", "cron", "spend_overflow"] as const)("retains direct %s rule effects before parent funding is redistributed", async cause => {
    const { t, auth, userId, pipeId, now } = await setup();
    await t.run(async ctx => {
      const parentId = await ctx.db.insert("pipes", { userId, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 2000, spent: 0 });
      await ctx.db.patch("pipes", pipeId, {
        parentId,
        ...(cause === "cron" ? { cronNextDate: Date.UTC(2026, 9, 1, 5) } : {}),
        ...(cause === "spend_overflow" ? { rule: "spend_overflow", spent: 0, pendingFedAdjustment: 0 } : {}),
      });
    });
    if (cause === "manual") await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    else if (cause === "cron") await t.mutation(internal.pipes.runDueCronRules, { now });
    else await auth.mutation(api.financialOperations.create, { from: pipeId, title: "coffee", value: -5000, date: now });
    const event = (await auth.query(api.events.latest, { pipeId })).find(entry => entry.type === "settlement");
    const pipe = await t.run(ctx => ctx.db.get("pipes", pipeId));
    expect(event).toMatchObject({ cause, after: { fed: cause === "spend_overflow" ? -1000 : 1500 } });
    expect(pipe?.fed).toBe(cause === "spend_overflow" ? 1000 : 3500);
    if (cause === "cron") await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("records automatic overflow at execution time, not the backdated expense date", async () => {
    const { t, auth, pipeId, now } = await setup();
    await t.run(ctx => ctx.db.patch("pipes", pipeId, { rule: "spend_overflow", spent: 0, pendingFedAdjustment: 0 }));
    await auth.mutation(api.financialOperations.create, { from: pipeId, title: "coffee", value: -5000, date: now - 86400000 });
    const history = await auth.query(api.events.latest, { pipeId });
    expect(history).toHaveLength(2);
    expect(history.find(event => event.type === "settlement")).toMatchObject({
      cause: "spend_overflow",
      occurredAt: now,
      before: { fed: 4000, spent: 5000, capacity: 4000, pendingFedAdjustment: 0 },
      after: { fed: -1000, spent: 0, capacity: 3000, pendingFedAdjustment: 0 },
    });
    expect(history.find(event => event.type === "transaction")).toMatchObject({ value: -5000, occurredAt: now - 86400000 });
  });

  it("records overdue scheduled settlement once and does not duplicate its event on retry", async () => {
    const { t, auth, pipeId, now } = await setup();
    await t.run(ctx => ctx.db.patch("pipes", pipeId, { cronNextDate: Date.UTC(2026, 8, 1, 5) }));
    await t.mutation(internal.pipes.runDueCronRules, { now });
    const history = await auth.query(api.events.latest, { pipeId });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      type: "settlement",
      cause: "cron",
      occurredAt: now,
      before: { capacity: 4000, spent: 3000 },
      after: { capacity: 9000, spent: 0 },
    });
    await t.mutation(internal.pipes.runDueCronRules, { now });
    expect(await auth.query(api.events.latest, { pipeId })).toEqual(history);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("keeps automatic instant settlement silent, but records explicit manual execution", async () => {
    const { t, auth, pipeId } = await setup();
    await t.run(ctx => ctx.db.patch("pipes", pipeId, { rule: "instant_settlement", spent: 0 }));
    await auth.mutation(api.financialOperations.create, { from: pipeId, title: "coffee", value: -500, date: Date.now() });
    expect((await auth.query(api.events.latest, { pipeId })).map(event => event.type)).toEqual(["transaction"]);
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const event = (await auth.query(api.events.latest, { pipeId })).find(event => event.type === "settlement");
    expect(event).toMatchObject({ cause: "manual" });
    expect(event).not.toHaveProperty("rule");
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toMatchObject({ rule: "instant_settlement" });
  });

  it("does not expose settlements through expense actions or correction history", async () => {
    const { auth, pipeId } = await setup();
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const [event] = await auth.query(api.events.latest, { pipeId });
    expect(await auth.query(api.financialOperations.get, { operationId: event.operationId })).toBeNull();
    await expect(auth.mutation(api.financialOperations.remove, { operationId: event.operationId })).rejects.toMatchObject({ data: { code: "OPERATION_NOT_FOUND" } });
    await expect(auth.query(api.operationCorrections.list, { operationId: event.operationId, paginationOpts: { numItems: 20, cursor: null } })).rejects.toMatchObject({ data: { code: "OPERATION_NOT_FOUND" } });
    expect(await auth.query(api.events.latest, { pipeId })).toEqual([event]);
  });

  it("contributes no expenditure, refunds, income, or offender spending to monthly reports", async () => {
    const { auth, pipeId } = await setup();
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const result = await auth.query(api.monthlySpendingStats.eventMonthPage, {
      periodStart: Date.UTC(2026, 9, 1), paginationOpts: { numItems: 100, cursor: null },
    });
    expect(result.page).toEqual([{ summary: expect.objectContaining({ totalIncomeCents: 0, grossSpendingCents: 0, refundCents: 0, spendingTransactionCount: 0, refundTransactionCount: 0 }), pipeSpending: [], titleSpending: [] }]);
  });

  it.each([false, true])("preserves or removes settlement history with pipe deletion (discard: %s)", async deleteTransactions => {
    const { t, auth, pipeId } = await setup();
    await auth.mutation(api.pipes.executePipeRuleNow, { pipeId });
    const [event] = await auth.query(api.events.latest, { pipeId });
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId, deleteTransactions });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.get("pipes", pipeId))).toBeNull();
    const history = await auth.query(api.events.latest, { pipeId });
    if (deleteTransactions) expect(history).toEqual([]);
    else {
      expect(history.find(entry => entry.type === "settlement")).toEqual(event);
      expect(history.find(entry => entry.type === "pipe_deletion")).toMatchObject({ name: "Coffee", icon: "cafe" });
    }
  });
});
