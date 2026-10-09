// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { defineSchema, defineTable } from "convex/server";
import { expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertFinancialOperation } from "../lib/events/financial";

it("rejects retired transaction-ID linkage on an operation-owned correction", async () => {
  // A test-only table supplies a real legacy ID without restoring production storage.
  const t = convexTest(defineSchema({ ...schema.tables, transactions: defineTable({}) }), modules);
  await expect(t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
    const operationId = await insertFinancialOperation(ctx, { userId, title: "food", value: -100, occurredAt: 1, structure: { type: "expense", from: pipeId } });
    const legacyLink = { transactionId: await ctx.db.insert("transactions", {}) };
    await ctx.db.insert("transactionCorrections", { userId, operationId, ...legacyLink, editedAt: 2,
      previous: { title: "food", value: -100, date: 1 }, current: { title: "lunch", value: -100, date: 1 } });
  })).rejects.toThrow("Unexpected field `transactionId`");
});

it("requires an operation ID on every correction", async () => {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { username: "alice", email: "a", password: "hash" }));
  await expect(t.run(async ctx => {
    // @ts-expect-error Operation-owned corrections require an operation ID.
    await ctx.db.insert("transactionCorrections", { userId, editedAt: 2,
      previous: { title: "food", value: -100, date: 1 }, current: { title: "lunch", value: -100, date: 1 } });
  })).rejects.toThrow("Missing required field `operationId`");
});
