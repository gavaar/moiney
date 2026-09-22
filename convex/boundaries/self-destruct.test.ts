// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { api, internal } from "../_generated/api";

const now = Date.UTC(2026, 8, 20, 17);
const deadline = Date.UTC(2026, 8, 21, 5);
async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(now);
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" }));
  const client = t.withIdentity({ subject: userId });
  const parentId = await client.mutation(api.pipes.addFeed, { name: "Travel", icon: "wallet", initialFed: 10000 });
  return { t, client, userId, parentId };
}
afterEach(() => vi.useRealTimers());

describe("creation-time rules", () => {
  it("creates the pipe, rule, and history event together and cancels the parent's rule when it gains children", async () => {
    const { t, client, parentId } = await setup();
    const child = await client.mutation(api.pipes.addPipe, {
      parentId, name: "Madrid", icon: "airplane", priority: 0, capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: deadline },
    });
    expect(await t.run((ctx) => ctx.db.get("pipes", child))).toMatchObject({
      rule: "self_destruct", cronNextDate: deadline, cronInterval: { interval: 0.5, unit: "days" }, fed: 10000,
    });
    expect(await t.run((ctx) => ctx.db.query("pipeCreationEvents").withIndex("by_pipeId", (q) => q.eq("pipeId", child)).unique())).not.toBeNull();
    await client.mutation(api.pipes.addPipe, { parentId: child, name: "Meals", icon: "food", priority: 0, capacity: 1000 });
    const formerLeaf = await t.run((ctx) => ctx.db.get("pipes", child));
    expect(formerLeaf?.rule).toBeUndefined();
    expect(formerLeaf?.cronNextDate).toBeUndefined();
    expect(formerLeaf?.cronInterval).toBeUndefined();
  });

  it("rolls back creation and owner changes when the deadline is not in the future", async () => {
    const { t, client, parentId } = await setup();
    await expect(client.mutation(api.pipes.addPipe, {
      parentId, name: "Madrid", icon: "airplane", priority: 0, capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: now },
    })).rejects.toThrow("INVALID_SELF_DESTRUCT_DATE");
    expect(await t.run((ctx) => ctx.db.query("pipes").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.query("pipeCreationEvents").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get("pipes", parentId))).toMatchObject({ fed: 10000, rule: "instant_settlement" });
  });

  it("applies existing settlement and cron configurations at creation", async () => {
    const { t, client, parentId } = await setup();
    const child = await client.mutation(api.pipes.addPipe, {
      parentId, name: "Budget", icon: "wallet", priority: 0, capacity: 1000,
      ruleConfig: { rule: "cron", starting: deadline, interval: 1, unit: "months", capUpdateValue: 500 },
    });
    expect(await t.run((ctx) => ctx.db.get("pipes", child))).toMatchObject({
      rule: "cron", capUpdateValue: 500, capacity: 1000, cronInterval: { interval: 1, unit: "months" },
    });
    await expect(client.mutation(api.pipes.updatePipeRule, { pipeId: parentId, rule: "self_destruct", starting: deadline }))
      .rejects.toThrow("SELF_DESTRUCT_REQUIRES_CHILD_LEAF");
    await client.mutation(api.pipes.updatePipeRule, { pipeId: child, rule: "self_destruct", starting: deadline });
    await expect(client.mutation(api.pipes.executePipeRuleNow, { pipeId: child })).rejects.toThrow("SELF_DESTRUCT_CANNOT_RUN_MANUALLY");
  });
});

describe("scheduled self-destruct", () => {
  it("continues to due self-destruct rules when a legacy cron schedule is invalid", async () => {
    const { t, client, parentId } = await setup();
    const child = await client.mutation(api.pipes.addPipe, {
      parentId,
      name: "Madrid",
      icon: "airplane",
      priority: 0,
      capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: deadline },
    });
    const legacyCron = await client.mutation(api.pipes.addFeed, {
      name: "Legacy cron",
      icon: "clock",
    });
    await t.run((ctx) => ctx.db.patch("pipes", legacyCron, {
      rule: "cron",
      cronNextDate: deadline - 1000,
      cronInterval: { interval: 0, unit: "days" },
      capUpdateValue: 100,
    }));

    vi.setSystemTime(deadline);
    await t.mutation(internal.pipes.runDueCronRules, { now: deadline });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(await t.run((ctx) => ctx.db.get("pipes", child))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("pipes", legacyCron))).toMatchObject({
      capacity: 0,
      cronNextDate: deadline - 1000,
    });
  });

  it.each([false, true])("conserves overdrafts and externally paid spending on automatic deletion (external=%s)", async (external) => {
    const { t, client } = await setup();
    const parentId = await client.mutation(api.pipes.addFeed, { name: "Trip owner", icon: "wallet", initialFed: 0 });
    const payer = await client.mutation(api.pipes.addFeed, { name: "Main", icon: "wallet", initialFed: 10000 });
    const child = await client.mutation(api.pipes.addPipe, {
      parentId, name: "Madrid", icon: "airplane", priority: 0, capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: deadline },
    });
    await client.mutation(api.transactions.createTransaction, {
      from: child, title: "hotel", value: -1000, date: now, ...(external ? { paidFrom: payer } : {}),
    });
    await client.mutation(api.transactions.createTransaction, {
      from: child, title: "refund", value: 200, date: now, ...(external ? { paidFrom: payer } : {}),
    });
    vi.setSystemTime(deadline);
    await t.mutation(internal.pipes.runDueCronRules, { now: deadline });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("pipes", child))).toBeNull();
    expect(await t.run((ctx) => ctx.db.get("pipes", parentId))).toMatchObject({ fed: external ? 0 : -800 });
    expect(await t.run((ctx) => ctx.db.get("pipes", payer))).toMatchObject({ fed: external ? 9200 : 10000 });
  });
  it("blocks a competing manual deletion in the same accounting tree while automatic deletion is frozen", async () => {
    const { t, client, parentId } = await setup();
    await client.mutation(api.pipes.addPipe, {
      parentId, name: "Madrid", icon: "airplane", priority: 0, capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: deadline },
    });
    const sibling = await client.mutation(api.pipes.addPipe, { parentId, name: "Paris", icon: "airplane", priority: 0, capacity: 10000 });
    vi.setSystemTime(deadline);
    const parent = await t.run((ctx) => ctx.db.get("pipes", parentId));
    await t.mutation(internal.pipes.processDueSelfDestructForUser, { userId: parent!.userId, now: deadline });
    await expect(client.mutation(api.pipes.startPipeDeletion, { pipeId: sibling, deleteTransactions: false }))
      .rejects.toThrow("Pipe is being deleted");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });
  it("waits until the deadline, deletes due siblings sequentially, preserves history and credits the signed balance once", async () => {
    const { t, client, parentId } = await setup();
    const children = [];
    for (const name of ["Madrid", "Paris"]) children.push(await client.mutation(api.pipes.addPipe, {
      parentId, name, icon: "airplane", priority: 0, capacity: 10000,
      ruleConfig: { rule: "self_destruct", starting: deadline },
    }));
    await client.mutation(api.transactions.createTransaction, { from: children[0], title: "hotel", value: -2000, date: now });
    await client.mutation(api.transactions.createTransaction, { from: children[1], title: "train", value: -1000, date: now });
    await t.mutation(internal.pipes.runDueCronRules, { now: deadline - 1 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("pipes").collect())).toHaveLength(3);
    vi.setSystemTime(deadline);
    await t.mutation(internal.pipes.runDueCronRules, { now: deadline });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.query("pipes").collect())).toHaveLength(1);
    expect(await t.run((ctx) => ctx.db.get("pipes", parentId))).toMatchObject({ fed: 7000 });
    expect(await t.run((ctx) => ctx.db.query("transactions").collect())).toHaveLength(2);
    const events = await t.run((ctx) => ctx.db.query("pipeCreationEvents").collect());
    expect(events.filter((event) => event.deletedAt !== undefined)).toHaveLength(2);
    await t.mutation(internal.pipes.runDueCronRules, { now: deadline });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get("pipes", parentId))).toMatchObject({ fed: 7000 });
  });
});
