// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertHistoryOperation } from "../lib/events/persistence";
import { api } from "../_generated/api";

const resolve = makeFunctionReference<"query">("transactions:forEventOperation");
describe("event action identity bridge", () => {
  it("resolves an owned exact operation to its real legacy action ID without leaking ownership or linkage", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
      const otherId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Source", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
      const operation = await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId, type: "transaction", title: "lunch", value: -100, occurredAt: 1 } });
      const transactionId = await ctx.db.insert("transactions", { userId, operationId: operation.canonicalEvent.id, from: pipeId, kind: "expense", title: "lunch", value: -100, date: 1, editedAt: 2 });
      await ctx.db.insert("transactionCorrections", { userId, transactionId, operationId: operation.canonicalEvent.id, editedAt: 2,
        previous: { title: "old", value: -100, date: 1 }, current: { title: "lunch", value: -100, date: 1 } });
      return { userId, otherId, operationId: operation.canonicalEvent.id, transactionId };
    });
    const auth = t.withIdentity({ subject: ids.userId });
    const row = await auth.query(resolve, { operationId: ids.operationId });
    expect(row).toMatchObject({ id: ids.transactionId, title: "lunch", editedAt: 2 });
    expect(row).not.toHaveProperty("operationId");
    expect(row).not.toHaveProperty("userId");
    expect(await auth.query(api.events.latest, {})).toEqual([expect.objectContaining({ id: ids.operationId, editedAt: 2 })]);
    expect((await auth.query(api.events.list, {})).events[0]).toMatchObject({ editedAt: 2 });
    expect(await t.withIdentity({ subject: ids.otherId }).query(resolve, { operationId: ids.operationId })).toBeNull();
    await expect(t.query(resolve, { operationId: ids.operationId })).rejects.toThrow("Not authenticated");
    await t.run(ctx => ctx.db.delete("transactions", ids.transactionId));
    expect(await auth.query(resolve, { operationId: ids.operationId })).toBeNull();
  });

  it("does not guess linkage from equal titles, lifecycle entries, or a mirror ID", async () => {
    const t = convexTest(schema, modules);
    const ids = await t.run(async ctx => {
      const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
      const fields = { userId, name: "Source", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
      const source = await ctx.db.insert("pipes", fields);
      const target = await ctx.db.insert("pipes", fields);
      const operation = await insertHistoryOperation(ctx, {
        canonicalEvent: { userId, pipeId: source, targetPipeId: target, type: "transfer", title: "same", value: -100, occurredAt: 1 },
        counterpart: { userId, pipeId: target, targetPipeId: source, type: "transfer", title: "same", value: 100, occurredAt: 1 },
      });
      const creation = await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: source, type: "pipe_creation", name: "Source", icon: "wallet", pipeType: "feed", ancestorIds: [], occurredAt: 1 } });
      await ctx.db.insert("transactions", { userId, kind: "transfer", from: source, to: target, title: "same", value: -100, date: 1 });
      return { userId, operation, creation };
    });
    const auth = t.withIdentity({ subject: ids.userId });
    expect(await auth.query(resolve, { operationId: ids.operation.canonicalEvent.id })).toBeNull();
    expect(await auth.query(resolve, { operationId: ids.creation.canonicalEvent.id })).toBeNull();
    expect(await auth.query(resolve, { operationId: ids.operation.counterpart!.id })).toBeNull();
  });
});
