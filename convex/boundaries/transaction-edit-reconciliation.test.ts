// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

it("rejects a structural edit when an unchanged role belongs to a frozen tree", async () => {
  const t = convexTest(schema, modules);
  const state = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      username: "alice",
      email: "alice@example.com",
      password: "hash",
    });
    const sourceRootId = await ctx.db.insert("pipes", {
      userId,
      name: "Source root",
      icon: "wallet",
      priority: 0,
      capacity: 1000,
      fed: 1000,
      spent: 0,
    });
    const sourceId = await ctx.db.insert("pipes", {
      userId,
      parentId: sourceRootId,
      name: "Source",
      icon: "cash",
      priority: 0,
      capacity: 500,
      fed: 500,
      spent: 0,
    });
    const frozenSiblingId = await ctx.db.insert("pipes", {
      userId,
      parentId: sourceRootId,
      name: "Frozen sibling",
      icon: "lock",
      priority: 1,
      capacity: 500,
      fed: 0,
      spent: 0,
    });
    const oldDestinationId = await ctx.db.insert("pipes", {
      userId,
      name: "Old destination",
      icon: "archive",
      priority: 0,
      capacity: 0,
      fed: 500,
      spent: 0,
    });
    const newDestinationId = await ctx.db.insert("pipes", {
      userId,
      name: "New destination",
      icon: "archive",
      priority: 0,
      capacity: 0,
      fed: 0,
      spent: 0,
    });
    const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
      userId,
      deleteTransactions: false,
      memberPipeIds: [frozenSiblingId],
      initialBalance: 0,
      phase: "processingTransactions",
      memberIndex: 0,
      role: "from",
    });
    await ctx.db.patch("pipes", frozenSiblingId, { deletionJobId });
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      title: "transfer",
      value: -100,
      date: 1000,
      kind: "transfer",
      from: sourceId,
      to: oldDestinationId,
    });
    return { userId, transactionId, newDestinationId };
  });

  await expect(
    t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.editTransaction,
      {
        transactionId: state.transactionId,
        title: "transfer",
        value: -100,
        date: 1000,
        target: { type: "transfer", to: state.newDestinationId },
      },
    ),
  ).rejects.toThrow("Pipe is being deleted");
});

it("moves a live expense between trees and records both roles in its correction", async () => {
  const t = convexTest(schema, modules);
  const { userId, oldId, nextId, transactionId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const oldId = await ctx.db.insert("pipes", { userId, name: "Old", icon: "cash", priority: 0, capacity: 10000, fed: 5000, spent: 2000 });
    const nextId = await ctx.db.insert("pipes", { userId, name: "New", icon: "cash", priority: 0, capacity: 10000, fed: 5000, spent: 0 });
    const transactionId = await ctx.db.insert("transactions", { userId, title: "lunch", value: -2000, date: 1000, kind: "expense", from: oldId });
    return { userId, oldId, nextId, transactionId };
  });
  await t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, {
    transactionId, title: "lunch", value: -1000, date: 1000, primaryPipeId: nextId,
  });
  await t.run(async ctx => {
    expect((await ctx.db.get("pipes", oldId))?.spent).toBe(0);
    expect((await ctx.db.get("pipes", nextId))?.spent).toBe(1000);
    expect((await ctx.db.get("transactions", transactionId))?.from).toBe(nextId);
    const corrections = await ctx.db.query("transactionCorrections").withIndex("by_transactionId", q => q.eq("transactionId", transactionId)).collect();
    expect(corrections[0]).toMatchObject({ previous: { from: oldId }, current: { from: nextId } });
  });
});

it("requires an explicit choice for a deleted source and changes only the surviving payer when disabled", async () => {
  const t = convexTest(schema, modules);
  const { userId, foodId, bankId, transactionId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const deletedId = await ctx.db.insert("pipes", { userId, name: "Deleted", icon: "cash", priority: 0, capacity: 5000, fed: 5000, spent: 2000 });
    const foodId = await ctx.db.insert("pipes", { userId, name: "Food", icon: "cash", priority: 0, capacity: 5000, fed: 5000, spent: 0 });
    const bankId = await ctx.db.insert("pipes", { userId, name: "Bank", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0 });
    const transactionId = await ctx.db.insert("transactions", { userId, title: "food", value: -2000, date: 1000, kind: "expense", from: deletedId, fromIcon: "cash", paidFrom: bankId });
    await ctx.db.delete("pipes", deletedId);
    return { userId, foodId, bankId, transactionId };
  });
  const edit = { transactionId, title: "food", value: -1000, date: 1000, primaryPipeId: foodId };
  await expect(t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, edit)).rejects.toThrow();
  await t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, { ...edit, applyReplacementEffects: false });
  await t.run(async ctx => {
    expect((await ctx.db.get("pipes", foodId))?.spent).toBe(0);
    expect((await ctx.db.get("pipes", bankId))?.fed).toBe(4000);
    const transaction = await ctx.db.get("transactions", transactionId);
    expect(transaction).toMatchObject({ from: foodId, paidFrom: bankId });
    expect(transaction?.fromIcon).toBeUndefined();
  });
});

it("replaces a deleted destination and applies its effect only when opted in", async () => {
  const t = convexTest(schema, modules);
  const { userId, sourceId, nextId, transactionId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const sourceId = await ctx.db.insert("pipes", { userId, name: "Source", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0 });
    const oldId = await ctx.db.insert("pipes", { userId, name: "Old", icon: "cash", priority: 0, capacity: 5000, fed: 2000, spent: 0 });
    const nextId = await ctx.db.insert("pipes", { userId, name: "New", icon: "cash", priority: 0, capacity: 5000, fed: 0, spent: 0, sourceType: "boiler", contributedFed: 0 });
    const transactionId = await ctx.db.insert("transactions", { userId, title: "move", value: -2000, date: 1000, kind: "transfer", from: sourceId, to: oldId, toIcon: "cash" });
    await ctx.db.delete("pipes", oldId);
    return { userId, sourceId, nextId, transactionId };
  });
  await t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, {
    transactionId, title: "move", value: -1000, date: 1000,
    target: { type: "transfer", to: nextId }, applyReplacementEffects: true,
  });
  await t.run(async ctx => {
    expect((await ctx.db.get("pipes", sourceId))?.fed).toBe(4000);
    expect(await ctx.db.get("pipes", nextId)).toMatchObject({ fed: 1000, contributedFed: 1000 });
    expect((await ctx.db.get("transactions", transactionId))?.toIcon).toBeUndefined();
  });
});

it("requires a replacement and choice for a live source that has become a parent", async () => {
  const t = convexTest(schema, modules);
  const { userId, oldId, nextId, transactionId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const oldId = await ctx.db.insert("pipes", { userId, name: "Old", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0 });
    await ctx.db.insert("pipes", { userId, parentId: oldId, name: "Child", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0 });
    const nextId = await ctx.db.insert("pipes", { userId, name: "New", icon: "cash", priority: 0, capacity: 5000, fed: 0, spent: 0 });
    const transactionId = await ctx.db.insert("transactions", { userId, title: "lunch", value: -1000, date: 1000, kind: "expense", from: oldId });
    return { userId, oldId, nextId, transactionId };
  });
  const edit = { transactionId, title: "lunch", value: -1000, date: 1000, applyReplacementEffects: true };
  await expect(t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, edit)).rejects.toThrow();
  await t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, { ...edit, primaryPipeId: nextId });
  await t.run(async ctx => {
    expect((await ctx.db.get("pipes", oldId))?.spent).toBe(0);
    expect((await ctx.db.get("pipes", nextId))?.spent).toBe(1000);
  });
});

it("moves a live pay-by-transfer expense with its pending adjustment while keeping its payer", async () => {
  const t = convexTest(schema, modules);
  const { userId, oldId, nextId, bankId, transactionId } = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const oldId = await ctx.db.insert("pipes", { userId, name: "Old", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 2000, pendingFedAdjustment: 2000 });
    const nextId = await ctx.db.insert("pipes", { userId, name: "New", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0, pendingFedAdjustment: 0 });
    const bankId = await ctx.db.insert("pipes", { userId, name: "Bank", icon: "cash", priority: 0, capacity: 5000, fed: 3000, spent: 0 });
    const transactionId = await ctx.db.insert("transactions", { userId, title: "food", value: -2000, date: 1000, kind: "expense", from: oldId, paidFrom: bankId });
    return { userId, oldId, nextId, bankId, transactionId };
  });
  await t.withIdentity({ subject: userId }).mutation(api.transactions.editTransaction, {
    transactionId, title: "food", value: -1000, date: 1000, primaryPipeId: nextId,
  });
  await t.run(async ctx => {
    expect(await ctx.db.get("pipes", oldId)).toMatchObject({ spent: 0, pendingFedAdjustment: 0 });
    expect(await ctx.db.get("pipes", nextId)).toMatchObject({ spent: 1000, pendingFedAdjustment: 1000 });
    expect((await ctx.db.get("pipes", bankId))?.fed).toBe(4000);
  });
});
