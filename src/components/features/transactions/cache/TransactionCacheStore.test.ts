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
  const storage = {
    value: null as string | null,
    read: vi.fn(async () => storage.value),
    write: vi.fn(async (_accountKey: string, value: string) => {
      storage.value = value;
    }),
    remove: vi.fn(async () => {
      storage.value = null;
    }),
  };
  return storage;
}

describe("TransactionCacheStore", () => {
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
