import { describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { HISTORY_SCOPE } from "./transactionSnapshot";
import {
  TransactionCacheStore,
  type TransactionCacheStorage,
} from "./TransactionCacheStore";

function transaction(id: string): TransactionModel {
  return {
    id: id as Id<"transactions">,
    createdAt: 1,
    title: id,
    value: -100,
    date: 1,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
}

function memoryStorage(): TransactionCacheStorage & { value: string | null } {
  const values = new Map<string, string>();
  const storage = {
    get value() { return values.get("account-1") ?? null; },
    read: vi.fn(async (key: string) => values.get(key) ?? null),
    write: vi.fn(async (key: string, value: string) => {
      values.set(key, value);
    }),
    remove: vi.fn(async (key: string) => {
      values.delete(key);
    }),
  };
  return storage;
}

describe("TransactionCacheStore", () => {
  it("invalidates event History on legacy financial mutations and clears both stores on logout", async () => {
    const values = new Map<string, string>();
    const disk: TransactionCacheStorage = {
      read: async key => values.get(key) ?? null,
      write: async (key, value) => { values.set(key, value); },
      remove: async key => { values.delete(key); },
    };
    const store = new TransactionCacheStore("account-1", disk);
    await store.hydrate();
    const entries = [{ id: "event" as Id<"events">, operationId: "event" as Id<"events">, pipeId: "pipe" as Id<"pipes">, createdAt: 1, occurredAt: 1, title: "lunch", type: "transaction" as const, value: -100 }];
    for (const mutate of [
      () => store.addTransaction(transaction("tx-1")),
      () => store.updateTransaction(transaction("tx-1")),
      () => store.reconcileTransactions(["tx-1"], []),
      () => store.invalidateAll(),
    ]) {
      await store.eventHistory.mergeHead(entries, false, 1);
      expect(store.eventHistory.read().complete).toBe(true);
      await mutate();
      expect(store.eventHistory.read().complete).toBe(false);
      const hydrated = new TransactionCacheStore("account-1", disk);
      await hydrated.hydrate();
      expect(hydrated.eventHistory.read().complete).toBe(false);
    }
    await store.eventHistory.mergeHead(entries, false, 1);
    await store.clear();
    expect(values.size).toBe(0);
  });

  it("persists a created transaction in the cache", async () => {
    const storage = memoryStorage();
    const store = new TransactionCacheStore("account-1", storage);

    await store.hydrate();
    await store.addTransaction(transaction("tx-1"), 1);

    expect(store.cache.entities["tx-1"].transaction.title).toBe("tx-1");
    expect(JSON.parse(storage.value!).entities["tx-1"].transaction.title).toBe("tx-1");
  });

  it("persists an edited transaction in the cache", async () => {
    const storage = memoryStorage();
    const store = new TransactionCacheStore("account-1", storage);

    await store.hydrate();
    await store.addTransaction(transaction("tx-1"), 1);
    await store.updateTransaction({ ...transaction("tx-1"), title: "updated" }, 2);

    expect(store.cache.entities["tx-1"].transaction.title).toBe("updated");
    expect(JSON.parse(storage.value!).entities["tx-1"].transaction.title).toBe("updated");
  });

  it("persists deletion reconciliation", async () => {
    const storage = memoryStorage();
    const store = new TransactionCacheStore("account-1", storage);

    await store.hydrate();
    await store.replace(
      HISTORY_SCOPE,
      [transaction("deleted"), transaction("survives")],
      false,
      1,
    );
    await store.reconcileTransactions(
      ["deleted", "survives"],
      [{ ...transaction("survives"), title: "updated" }],
      2,
    );

    expect(store.cache.entities.deleted).toBeUndefined();
    expect(store.cache.entities.survives.transaction.title).toBe("updated");
    expect(JSON.parse(storage.value!).entities.deleted).toBeUndefined();
  });

  it("hydrates and persists snapshots through its storage adapter", async () => {
    const storage = memoryStorage();
    const first = new TransactionCacheStore("account-1", storage);

    await first.hydrate();
    await first.replace(HISTORY_SCOPE, [transaction("tx-1")], false, 1);

    const second = new TransactionCacheStore("account-1", storage);
    const cache = await second.hydrate();

    expect(cache.snapshots[HISTORY_SCOPE].ids).toEqual(["tx-1"]);
    expect(cache.entities["tx-1"].transaction.title).toBe("tx-1");
  });

  it("clears persisted data for the active account", async () => {
    const storage = memoryStorage();
    const store = new TransactionCacheStore("account-1", storage);

    await store.hydrate();
    await store.replace(HISTORY_SCOPE, [transaction("tx-1")], false, 1);
    await store.clear();

    expect(storage.value).toBeNull();
    expect(store.cache.entities).toEqual({});
  });

  it("invalidates snapshots while retaining cached entities", async () => {
    const storage = memoryStorage();
    const store = new TransactionCacheStore("account-1", storage);

    await store.hydrate();
    await store.replace(HISTORY_SCOPE, [transaction("tx-1")], false, 1);
    await store.invalidateAll(2);

    expect(store.cache.snapshots).toEqual({});
    expect(store.cache.entities["tx-1"]).toBeDefined();
  });

  it("ignores cache data belonging to another account", async () => {
    const storage = memoryStorage();
    const first = new TransactionCacheStore("account-1", storage);
    await first.hydrate();
    await first.replace(HISTORY_SCOPE, [transaction("tx-1")], false, 1);

    const second = new TransactionCacheStore("account-2", storage);
    const cache = await second.hydrate();

    expect(cache.entities).toEqual({});
  });
});
