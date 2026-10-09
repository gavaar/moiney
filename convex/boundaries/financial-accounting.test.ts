// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { createAndReadOperation, insertOperation } from "./financialFixtures.helpers";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const fields = { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 1000, fed: 500, spent: 100 };
    return { userId, source: await ctx.db.insert("pipes", fields), payer: await ctx.db.insert("pipes", { ...fields, fed: 200, spent: 50 }) };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

it.each([
  { rule: "instant_settlement", value: -30, capacity: 100, fed: 370, spent: 0 },
  { rule: "instant_settlement", value: 30, capacity: 100, fed: 430, spent: 0 },
  { rule: "spend_overflow", value: -30, capacity: 130, fed: 370, spent: 0 },
  { rule: "spend_overflow", value: -30, capacity: 200, fed: 500, spent: 130 },
  { rule: "spend_overflow", value: 30, capacity: 50, fed: 500, spent: 70 },
] as const)("applies $rule to creation at $value cents with capacity $capacity", async ({ rule, value, capacity, fed, spent }) => {
  const { t, auth, source } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule, capacity }));
  await auth.mutation(api.financialOperations.create, { from: source, title: "food", value, date: 1 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed, spent });
});

it("applies cap updates to actual post-spend balances", async () => {
  const { t, auth, source } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule: "spend_overflow", capacity: 100, capUpdateValue: 50 }));
  await auth.mutation(api.financialOperations.create, { from: source, title: "food", value: -30, date: 1 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 370, spent: 0, capacity: 20 });
});

it("does not trigger settlement for a transfer", async () => {
  const { t, auth, source, payer } = await setup();
  await t.run(ctx => ctx.db.patch("pipes", source, { rule: "instant_settlement" }));
  await auth.mutation(api.financialOperations.create, { from: source, to: payer, title: "move", value: -50, date: 1 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 450, spent: 100 });
  expect(await t.run(ctx => ctx.db.get("pipes", payer))).toMatchObject({ fed: 250, spent: 50 });
});

it.each(["instant_settlement", "spend_overflow"] as const)("applies %s to an edit's current-period spending delta", async rule => {
  const { t, auth, source, userId } = await setup();
  const operationId = await t.run(async ctx => {
    await ctx.db.patch("pipes", source, { rule, capacity: 130 });
    return insertOperation(ctx, { userId, from: source, kind: "expense", title: "old", value: -50, date: 1 });
  });
  await auth.mutation(api.financialOperations.edit, { operationId, title: "new", value: -80, date: 2 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 370, spent: 0 });
});

it("settles an edited external expense without replaying its historical spending", async () => {
  const { t, auth, source, payer, userId } = await setup();
  const operationId = await t.run(async ctx => {
    await ctx.db.patch("pipes", source, { rule: "instant_settlement" });
    return insertOperation(ctx, { userId, from: source, paidFrom: payer, kind: "expense", title: "old", value: -50, date: 1 });
  });
  await auth.mutation(api.financialOperations.edit, { operationId, title: "new", value: -80, date: 2 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 400, spent: 0, pendingFedAdjustment: 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", payer))).toMatchObject({ fed: 170 });
});

it("accepts an external refund into a root with children and reconciles its tree", async () => {
  const { t, auth, source, payer, userId } = await setup();
  const child = await t.run(ctx => ctx.db.insert("pipes", { userId, parentId: payer, name: "Child", icon: "food", priority: 0, capacity: 100, fed: 100, spent: 0 }));
  await auth.mutation(api.financialOperations.create, { from: source, paidFrom: payer, title: "refund", value: 30, date: 1 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ spent: 70, pendingFedAdjustment: -30 });
  expect(await t.run(ctx => ctx.db.get("pipes", payer))).toMatchObject({ fed: 230 });
  expect(await t.run(ctx => ctx.db.get("pipes", child))).toMatchObject({ fed: 100 });
});

it.each(["create", "edit"] as const)("redistributes payer-tree liquidity after an external refund %s", async action => {
  const { t, auth, source, payer, userId } = await setup();
  const child = await t.run(async ctx => {
    await ctx.db.patch("pipes", payer, { fed: 0, spent: 0 });
    return ctx.db.insert("pipes", { userId, parentId: payer, name: "Savings", icon: "bank", priority: 0, capacity: 1000, fed: 200, spent: 0 });
  });
  if (action === "create") {
    await auth.mutation(api.financialOperations.create, { from: source, paidFrom: payer, title: "refund", value: 30, date: 1 });
  } else {
    const { operationId } = await createAndReadOperation(t, auth, { from: source, paidFrom: payer, title: "refund", value: 30, date: 1 });
    expect(await t.run(ctx => ctx.db.get("pipes", child))).toMatchObject({ fed: 230 });
    await auth.mutation(api.financialOperations.edit, { operationId, title: "refund", value: 60, date: 1 });
  }
  expect(await t.run(ctx => ctx.db.get("pipes", payer))).toMatchObject({ fed: 0, spent: 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", child))).toMatchObject({ fed: action === "create" ? 230 : 260, spent: 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ spent: action === "create" ? 70 : 40, pendingFedAdjustment: action === "create" ? -30 : -60 });
});

it("rejects changing an external expense to a refund into a non-root payer atomically", async () => {
  const { t, auth, source, payer, userId } = await setup();
  const parent = await t.run(ctx => ctx.db.insert("pipes", { userId, name: "Bank", icon: "bank", priority: 0, capacity: 0, fed: 1000, spent: 0 }));
  await t.run(ctx => ctx.db.patch("pipes", payer, { parentId: parent }));
  const { operationId } = await createAndReadOperation(t, auth, { from: source, paidFrom: payer, title: "food", value: -50, date: 1 });
  const before = await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }));
  await expect(auth.mutation(api.financialOperations.edit, { operationId, title: "refund", value: 30, date: 2 }))
    .rejects.toThrow("Refund destination must be a root outside the transaction tree");
  expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
});

it.each(["missing_roles", "same_payer", "blank_title"] as const)("rejects %s creation without writes", async invalid => {
  const { t, auth, source } = await setup();
  const args = { title: invalid === "blank_title" ? "  " : "food", value: -30, date: 1,
    ...(invalid !== "missing_roles" ? { from: source } : {}), ...(invalid === "same_payer" ? { paidFrom: source } : {}) };
  const before = await t.run(ctx => ctx.db.query("pipes").collect());
  await expect(auth.mutation(api.financialOperations.create, args)).rejects.toThrow();
  expect(await t.run(ctx => ctx.db.query("pipes").collect())).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  expect(await t.run(ctx => ctx.db.query("transactionTitleUsage").collect())).toEqual([]);
});
