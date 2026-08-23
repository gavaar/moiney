import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  CACHE_VERSION,
  HISTORY_SCOPE,
  MAX_CACHED_TRANSACTIONS,
  appendSnapshot,
  createCache,
  deserializeCache,
  invalidateSnapshots,
  pipeScope,
  readSnapshot,
  replaceSnapshot,
  mergeHeadSnapshot,
  serializeCache,
} from "./transactionSnapshot";

function transaction(id: string, date: number): TransactionModel {
  return {
    id: id as Id<"transactions">,
    createdAt: date,
    title: id,
    value: -100,
    date,
    kind: "expense",
    from: "pipe-1" as Id<"pipes">,
  };
}

describe("transaction snapshot cache", () => {
  it("canonicalizes pipe scope keys", () => {
    expect(pipeScope(["pipe-2", "pipe-1", "pipe-2"])).toBe(
      "pipes:pipe-1,pipe-2",
    );
  });

  it("replaces a snapshot and reads normalized transactions", () => {
    const cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("tx-1", 100), transaction("tx-2", 200)],
      true,
      1,
    );

    expect(readSnapshot(cache, HISTORY_SCOPE)).toEqual({
      transactions: expect.arrayContaining([
        expect.objectContaining({ id: "tx-1" }),
        expect.objectContaining({ id: "tx-2" }),
      ]),
      complete: true,
      hasMore: true,
      updatedAt: 1,
    });
  });

  it("appends older pages without duplicating transactions", () => {
    let cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("tx-3", 300), transaction("tx-2", 200)],
      true,
      1,
    );
    cache = appendSnapshot(
      cache,
      HISTORY_SCOPE,
      [transaction("tx-2", 200), transaction("tx-1", 100)],
      false,
      2,
    );

    expect(readSnapshot(cache, HISTORY_SCOPE)).toMatchObject({
      transactions: [
        expect.objectContaining({ id: "tx-3" }),
        expect.objectContaining({ id: "tx-2" }),
        expect.objectContaining({ id: "tx-1" }),
      ],
      hasMore: false,
    });
  });

  it("refreshes the newest page without discarding older loaded rows", () => {
    let cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("tx-3", 300), transaction("tx-2", 200), transaction("tx-1", 100)],
      false,
      1,
    );
    cache = mergeHeadSnapshot(
      cache,
      HISTORY_SCOPE,
      [transaction("tx-4", 400), transaction("tx-2", 250)],
      true,
      2,
    );

    expect(readSnapshot(cache, HISTORY_SCOPE).transactions.map(({ id }) => id)).toEqual([
      "tx-4",
      "tx-2",
      "tx-3",
      "tx-1",
    ]);
    expect(cache.entities["tx-2"].transaction.date).toBe(250);
  });

  it("keeps at most the configured number of unique entities", () => {
    const rows = Array.from({ length: MAX_CACHED_TRANSACTIONS + 1 }, (_, index) =>
      transaction(`tx-${index}`, index),
    );
    const cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      rows,
      false,
      1,
    );

    expect(Object.keys(cache.entities)).toHaveLength(MAX_CACHED_TRANSACTIONS);
    expect(readSnapshot(cache, HISTORY_SCOPE).transactions).toHaveLength(
      MAX_CACHED_TRANSACTIONS,
    );
  });

  it("rejects snapshots from another account or cache version", () => {
    const serialized = serializeCache(createCache("account-1"));
    expect(deserializeCache(serialized, "account-2")).toBeNull();
    expect(
      deserializeCache(
        JSON.stringify({ version: CACHE_VERSION + 1, accountKey: "account-1" }),
        "account-1",
      ),
    ).toBeNull();
    expect(deserializeCache("not-json", "account-1")).toBeNull();
  });

  it("invalidates scope snapshots without discarding transaction entities", () => {
    const cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("tx-1", 100)],
      false,
      1,
    );

    const invalidated = invalidateSnapshots(cache, 2);

    expect(invalidated.snapshots).toEqual({});
    expect(invalidated.entities["tx-1"]).toBeDefined();
  });
});
