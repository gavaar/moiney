// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../schema";
import { modules } from "../../test.setup";
import { insertHistoryOperation, readHistoryOperation } from "./persistence";
import { MAX_AMOUNT } from "../../../domain/money";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const otherUserId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Wallet", icon: "wallet-outline", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
    const targetPipeId = await ctx.db.insert("pipes", { userId, parentId: pipeId, name: "Food", icon: "cart", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
    const otherPipeId = await ctx.db.insert("pipes", { userId: otherUserId, name: "Other wallet", icon: "wallet-outline", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
    return { userId, otherUserId, pipeId, targetPipeId, otherPipeId };
  });
  return { t, ...ids };
}

describe("history event persistence", () => {
  it.each(["feed", "transaction"] as const)("persists a single %s with its own ID as operation ID", async (type) => {
    const { t, userId, pipeId } = await setup();
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type, userId, pipeId, occurredAt: 1000, title: "salary", value: type === "feed" ? 100 : -100 },
    }));
    expect(operation.canonicalEvent).toMatchObject({ type, userId, pipeId, occurredAt: 1000 });
    expect(operation.canonicalEvent.operationId).toBe(operation.canonicalEvent.id);
    expect(operation.counterpart).toBeUndefined();
    expect(await t.run((ctx) => readHistoryOperation(ctx, userId, operation.canonicalEvent.id))).toEqual(operation);
    const persisted = await t.run((ctx) => ctx.db.get("events", operation.canonicalEvent.id));
    expect(persisted?.operationId).toBe(operation.canonicalEvent.id);
  });

  it.each(["transfer", "third_party_transaction"] as const)("persists both %s perspectives and resolves through either entry", async (type) => {
    const { t, userId, pipeId, targetPipeId } = await setup();
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type, userId, pipeId, targetPipeId, occurredAt: 1000, title: "lunch", value: -100 },
      counterpart: { type: type === "transfer" ? "transfer" : "transaction", userId, pipeId: targetPipeId, targetPipeId: pipeId, occurredAt: 1000, title: "lunch", value: 100 },
    }));
    expect(operation.counterpart).toBeDefined();
    expect(operation.counterpart?.id).not.toBe(operation.canonicalEvent.id);
    expect(operation.counterpart?.operationId).toBe(operation.canonicalEvent.id);
    expect(await t.run((ctx) => readHistoryOperation(ctx, userId, operation.counterpart!.id))).toEqual(operation);
  });

  it.each(["pipe_creation", "pipe_deletion"] as const)("retains %s presentation and ancestry without a live pipe", async (type) => {
    const { t, userId, pipeId, targetPipeId } = await setup();
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type, userId, pipeId: targetPipeId, occurredAt: 1000, name: "Food", icon: "cart", pipeType: "pipe", ancestorIds: [pipeId], parentName: "Wallet", parentIcon: "wallet-outline" },
    }));
    await t.run((ctx) => ctx.db.delete("pipes", targetPipeId));
    expect(await t.run((ctx) => readHistoryOperation(ctx, userId, operation.canonicalEvent.id))).toEqual(operation);
  });

  it("does not expose an operation to another account", async () => {
    const { t, userId, otherUserId, pipeId } = await setup();
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type: "transaction", userId, pipeId, occurredAt: 1000, title: "lunch", value: -100 },
    }));
    expect(await t.run((ctx) => readHistoryOperation(ctx, otherUserId, operation.canonicalEvent.id))).toBeNull();
    await t.run((ctx) => ctx.db.delete("events", operation.canonicalEvent.id));
    expect(await t.run((ctx) => readHistoryOperation(ctx, userId, operation.canonicalEvent.id))).toBeNull();
  });

  it.each([0, 0.5, MAX_AMOUNT + 1, NaN, Infinity])("rejects invalid cents %s without leaving entries", async (value) => {
    const { t, userId, pipeId } = await setup();
    await expect(t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type: "transaction", userId, pipeId, occurredAt: 1000, title: "lunch", value },
    }))).rejects.toThrow();
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toEqual([]);
  });

  it("rejects a cross-account mirror without leaving either entry", async () => {
    const { t, userId, otherUserId, pipeId, targetPipeId } = await setup();
    await expect(t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type: "transfer", userId, pipeId, targetPipeId, occurredAt: 1000, title: "move", value: -100 },
      counterpart: { type: "transfer", userId: otherUserId, pipeId: targetPipeId, targetPipeId: pipeId, occurredAt: 1000, title: "move", value: 100 },
    }))).rejects.toThrow("Inconsistent operation identity");
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toEqual([]);
  });

  it("rejects an incomplete operation instead of returning a partial write model", async () => {
    const { t, userId, pipeId, targetPipeId } = await setup();
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, {
      canonicalEvent: { type: "transfer", userId, pipeId, targetPipeId, occurredAt: 1000, title: "move", value: -100 },
      counterpart: { type: "transfer", userId, pipeId: targetPipeId, targetPipeId: pipeId, occurredAt: 1000, title: "move", value: 100 },
    }));
    await t.run((ctx) => ctx.db.delete("events", operation.counterpart!.id));
    await expect(t.run((ctx) => readHistoryOperation(ctx, userId, operation.canonicalEvent.id))).rejects.toThrow("Operation requires a transfer counterpart");
  });

  it("rejects an extra operation entry rather than resolving an unbounded set", async () => {
    const { t, userId, pipeId } = await setup();
    const draft = { type: "transaction" as const, userId, pipeId, occurredAt: 1000, title: "lunch", value: -100 };
    const operation = await t.run((ctx) => insertHistoryOperation(ctx, { canonicalEvent: draft }));
    await t.run(async (ctx) => {
      await ctx.db.insert("events", { ...draft, operationId: operation.canonicalEvent.id });
      await ctx.db.insert("events", { ...draft, operationId: operation.canonicalEvent.id });
    });
    await expect(t.run((ctx) => readHistoryOperation(ctx, userId, operation.canonicalEvent.id))).rejects.toThrow("An operation requires one or two entries");
  });

  it("rejects a persisted entry missing its operation ID", async () => {
    const { t, userId, pipeId } = await setup();
    const eventId = await t.run((ctx) => ctx.db.insert("events", {
      type: "transaction", userId, pipeId, occurredAt: 1000, title: "lunch", value: -100,
    }));
    await expect(t.run((ctx) => readHistoryOperation(ctx, userId, eventId))).rejects.toThrow("History event is missing its operation ID");
  });

  it("supports account-wide and per-pipe chronological indexed reads", async () => {
    const { t, userId, otherUserId, pipeId, targetPipeId, otherPipeId } = await setup();
    for (const [owner, pipe, occurredAt] of [[userId, pipeId, 1000], [userId, targetPipeId, 2000], [otherUserId, otherPipeId, 3000]] as const) {
      await t.run((ctx) => insertHistoryOperation(ctx, {
        canonicalEvent: { type: "transaction", userId: owner, pipeId: pipe, occurredAt, title: "lunch", value: -100 },
      }));
    }
    const accountRows = await t.run((ctx) => ctx.db.query("events")
      .withIndex("by_userId_occurredAt", q => q.eq("userId", userId)).order("desc").take(30));
    expect(accountRows.map(row => row.occurredAt)).toEqual([2000, 1000]);
    const pipeRows = await t.run((ctx) => ctx.db.query("events")
      .withIndex("by_userId_pipeId_occurredAt", q => q.eq("userId", userId).eq("pipeId", pipeId)).order("desc").take(30));
    expect(pipeRows.map(row => row.occurredAt)).toEqual([1000]);
  });

  it("schema forbids targets on feeds and financial fields on lifecycle events", async () => {
    const { t, userId, pipeId, targetPipeId } = await setup();
    const feedWithTarget = { type: "feed" as const, userId, pipeId, occurredAt: 1000, title: "salary", value: 100, targetPipeId };
    await expect(t.run(ctx => ctx.db.insert("events", feedWithTarget))).rejects.toThrow();
    const creationWithMoney = { type: "pipe_creation" as const, userId, pipeId, occurredAt: 1000, name: "Wallet", icon: "wallet-outline", pipeType: "feed" as const, ancestorIds: [], value: 100 };
    await expect(t.run(ctx => ctx.db.insert("events", creationWithMoney))).rejects.toThrow();
  });
});
