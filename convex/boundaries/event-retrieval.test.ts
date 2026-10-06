// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { describe, expect, it } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertHistoryOperation } from "../lib/events/persistence";

const latest = makeFunctionReference<"query">("events:latest");
const list = makeFunctionReference<"query">("events:list");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const otherId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const pipe = { userId, name: "Root", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
    const root = await ctx.db.insert("pipes", pipe);
    const target = await ctx.db.insert("pipes", { ...pipe, name: "Target" });
    return { userId, otherId, root, target };
  });
  return { t, ...ids, auth: t.withIdentity({ subject: ids.userId }) };
}

describe("Convex boundaries: event retrieval", () => {
  it("returns the latest 30 stored entries, not 30 expanded or grouped operations", async () => {
    const { t, auth, userId, otherId, root, target } = await setup();
    await t.run(async ctx => {
      for (let i = 0; i < 20; i++) await insertHistoryOperation(ctx, {
        canonicalEvent: { userId, pipeId: root, targetPipeId: target, type: "transfer", title: "same", value: -100, occurredAt: i },
        counterpart: { userId, pipeId: target, targetPipeId: root, type: "transfer", title: "same", value: 100, occurredAt: i },
      });
      await insertHistoryOperation(ctx, { canonicalEvent: { userId: otherId, pipeId: root, type: "transaction", title: "private", value: -1, occurredAt: 1000 } });
    });
    const result = await auth.query(latest, {});
    expect(result).toHaveLength(30);
    expect(new Set(result.map((event: { operationId: string }) => event.operationId)).size).toBe(15);
    expect(result.map((event: { occurredAt: number }) => event.occurredAt)).toEqual(Array.from({ length: 15 }, (_, i) => [19 - i, 19 - i]).flat());
    for (const event of result) {
      expect(event).toHaveProperty("id");
      expect(event).toHaveProperty("createdAt");
      expect(event).not.toHaveProperty("userId");
      expect(event).not.toHaveProperty("_id");
      expect(event).not.toHaveProperty("_creationTime");
    }
  });

  it("reads the selected pipe's own perspectives even after physical deletion", async () => {
    const { t, auth, userId, root, target } = await setup();
    const operation = await t.run(ctx => insertHistoryOperation(ctx, {
      canonicalEvent: { userId, pipeId: root, targetPipeId: target, type: "third_party_transaction", title: "hotel", value: -100, occurredAt: 1000 },
      counterpart: { userId, pipeId: target, targetPipeId: root, type: "transaction", title: "hotel", value: 100, occurredAt: 1000 },
    }));
    await t.run(ctx => ctx.db.delete("pipes", target));
    expect(await auth.query(latest, { pipeId: target })).toEqual([
      expect.objectContaining({ id: operation.counterpart!.id, operationId: operation.canonicalEvent.id, type: "transaction", pipeId: target, targetPipeId: root, value: 100 }),
    ]);
    const page = await auth.query(list, { pipeId: target, limit: 1 });
    expect(page.events).toHaveLength(1);
    expect(page.events[0].id).toBe(operation.counterpart!.id);
    expect(page).toMatchObject({ isDone: true, cursor: null });
  });

  it("paginates tied timestamps without dropping or duplicating entries, including partial operations", async () => {
    const { t, auth, userId, root, target } = await setup();
    const insertedIds = await t.run(async ctx => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const operation = await insertHistoryOperation(ctx, {
          canonicalEvent: { userId, pipeId: root, targetPipeId: target, type: "transfer", title: "same", value: -100, occurredAt: 1000 },
          counterpart: { userId, pipeId: target, targetPipeId: root, type: "transfer", title: "same", value: 100, occurredAt: 1000 },
        });
        ids.push(operation.canonicalEvent.id, operation.counterpart!.id);
      }
      return ids;
    });
    const expected = await auth.query(latest, {});
    const entries = [];
    let cursor: string | undefined;
    for (let i = 0; i < 6; i++) {
      const page = await auth.query(list, { cursor, limit: 1 });
      entries.push(...page.events);
      if (page.isDone) { expect(page.cursor).toBeNull(); break; }
      expect(page.cursor).toEqual(expect.any(String));
      cursor = page.cursor;
    }
    expect(entries).toEqual(expected);
    expect(entries.map(event => event.id)).toEqual([...insertedIds].reverse());
    expect(new Set(entries.map(event => event.id)).size).toBe(6);
  });

  it("returns lifecycle snapshots and financial types without server presentation grouping", async () => {
    const { t, auth, userId, root } = await setup();
    await t.run(async ctx => {
      for (const type of ["pipe_creation", "pipe_deletion"] as const) await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type, occurredAt: 1000, name: "Final name", icon: "cafe", pipeType: "feed", ancestorIds: [], parentName: "Snapshot parent", parentIcon: "cart" } });
      await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type: "feed", title: "Income", value: 100, occurredAt: 2000 } });
      await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type: "transaction", title: "refund", value: 50, occurredAt: 3000 } });
    });
    const page = await auth.query(list, {});
    expect(page.events.map((event: { type: string }) => event.type)).toEqual(["transaction", "feed", "pipe_deletion", "pipe_creation"]);
    for (const event of page.events.filter((event: { type: string }) => event.type.startsWith("pipe_"))) {
      expect(event).toMatchObject({ name: "Final name", parentName: "Snapshot parent", ancestorIds: [] });
      expect(event).not.toHaveProperty("title");
      expect(event).not.toHaveProperty("value");
    }
    const matching = await auth.query(list, { title: " FINAL NAME " });
    expect(matching.events.map((event: { type: string }) => event.type)).toEqual(["pipe_deletion", "pipe_creation"]);
  });

  it("uses 30 entries by default and permits a bounded 100-entry page", async () => {
    const { t, auth, userId, root } = await setup();
    await t.run(async ctx => {
      for (let occurredAt = 0; occurredAt < 101; occurredAt++) await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type: "feed", title: "Income", value: 100, occurredAt } });
    });
    const defaultPage = await auth.query(list, {});
    expect(defaultPage.events).toHaveLength(30);
    expect(defaultPage.isDone).toBe(false);
    const maximumPage = await auth.query(list, { limit: 100 });
    expect(maximumPage.events).toHaveLength(100);
    expect(maximumPage.isDone).toBe(false);
    const last = await auth.query(list, { limit: 100, cursor: maximumPage.cursor });
    expect(last).toMatchObject({ events: [expect.objectContaining({ occurredAt: 0 })], isDone: true, cursor: null });
  });

  it("applies inclusive date ranges and consumes bounded pages before text matching", async () => {
    const { t, auth, userId, root } = await setup();
    await t.run(async ctx => {
      for (const occurredAt of [1000, 2000, 3000]) await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type: "transaction", occurredAt, title: occurredAt === 1000 ? "HOTEL" : "other", value: -100 } });
    });
    const first = await auth.query(list, { pipeId: root, fromDate: 1000, toDate: 2000, title: " hotel ", limit: 1 });
    expect(first.events).toEqual([]);
    expect(first.isDone).toBe(false);
    const second = await auth.query(list, { pipeId: root, fromDate: 1000, toDate: 2000, title: " hotel ", limit: 1, cursor: first.cursor });
    expect(second.events).toEqual([expect.objectContaining({ occurredAt: 1000, title: "HOTEL" })]);
    expect(second).toMatchObject({ isDone: true, cursor: null });
  });

  it("rejects unauthenticated requests and never returns another account's entries", async () => {
    const { t, auth, userId, otherId, root } = await setup();
    await t.run(ctx => insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: root, type: "transaction", title: "own", value: -1, occurredAt: 1000 } }));
    await expect(t.query(latest, {})).rejects.toThrow();
    await expect(t.query(list, {})).rejects.toThrow();
    const other = t.withIdentity({ subject: otherId });
    expect(await other.query(latest, { pipeId: root })).toEqual([]);
    expect(await other.query(list, { pipeId: root })).toMatchObject({ events: [], isDone: true, cursor: null });
    expect(await auth.query(latest, {})).toHaveLength(1);
  });

  it("rejects committed entries missing operation identity without needing a complete mirror", async () => {
    const { t, auth, userId, root, target } = await setup();
    const id = await t.run(ctx => ctx.db.insert("events", { userId, pipeId: root, type: "transfer", targetPipeId: target, value: -1, title: "partial", occurredAt: 1000 }));
    await expect(auth.query(latest, {})).rejects.toThrow("missing its operation ID");
    await expect(auth.query(list, {})).rejects.toThrow("missing its operation ID");
    await t.run(ctx => ctx.db.patch("events", id, { operationId: id }));
    expect(await auth.query(latest, {})).toHaveLength(1);
    expect((await auth.query(list, {})).events).toHaveLength(1);
  });

  it.each([0, -1, 101, 1.5])("rejects invalid page limit %s", async limit => {
    const { auth } = await setup();
    await expect(auth.query(list, { limit })).rejects.toThrow("INVALID_HISTORY_LIMIT");
  });

  it.each([{ fromDate: 2000, toDate: 1000 }, { fromDate: Infinity }, { toDate: NaN }])("rejects invalid date filters %j", async filters => {
    const { auth } = await setup();
    await expect(auth.query(list, filters)).rejects.toThrow("INVALID_TRANSACTION_DATE_RANGE");
  });
});
