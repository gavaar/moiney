import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  CACHE_VERSION,
  HISTORY_SCOPE,
  RECENT_SCOPE,
  MAX_CACHED_TRANSACTIONS,
  appendSnapshot,
  createCache,
  deserializeCache,
  insertTransaction,
  invalidateSnapshots,
  pipeScope,
  readSnapshot,
  reconcileTransactions,
  replaceSnapshot,
  updateTransaction,
  mergeHeadSnapshot,
  serializeCache,
} from "./transactionSnapshot";

function transaction(
  id: string,
  date: number,
  from: string = "pipe-1",
): TransactionModel {
  return {
    id: id as Id<"transactions">,
    createdAt: date,
    title: id,
    value: -100,
    date,
    kind: "expense",
    from: from as Id<"pipes">,
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

  it("inserts a created transaction into loaded relevant scopes with a 30-row recent limit", () => {
    const existing = Array.from({ length: 30 }, (_, index) =>
      transaction(`existing-${index}`, 100 - index, "pipe-c"),
    );
    let cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("history", 1, "pipe-c")],
      false,
      1,
    );
    cache = replaceSnapshot(cache, RECENT_SCOPE, existing, false, 1);
    cache = replaceSnapshot(cache, pipeScope(["pipe-c"]), existing, false, 1);
    cache = replaceSnapshot(cache, pipeScope(["pipe-b", "pipe-c"]), existing, false, 1);
    cache = replaceSnapshot(cache, pipeScope(["unrelated"]), existing, false, 1);

    const next = insertTransaction(cache, transaction("created", 200, "pipe-c"), 2);

    expect(next.entities.created.transaction).toMatchObject({ id: "created" });
    expect(readSnapshot(next, HISTORY_SCOPE).transactions.map(({ id }) => id)).toContain(
      "created",
    );
    expect(readSnapshot(next, RECENT_SCOPE).transactions.map(({ id }) => id)).toEqual([
      "created",
      ...existing.slice(0, 29).map(({ id }) => id),
    ]);
    expect(readSnapshot(next, pipeScope(["pipe-b", "pipe-c"])).transactions.map(({ id }) => id)).toContain(
      "created",
    );
    expect(readSnapshot(next, pipeScope(["unrelated"])).transactions.map(({ id }) => id)).not.toContain(
      "created",
    );
    expect(next.snapshots[pipeScope(["pipe-a", "pipe-c"])]).toBeUndefined();
  });

  it("updates a cached transaction and reorders loaded views", () => {
    let cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("older", 100), transaction("edited", 200)],
      false,
      1,
    );
    cache = replaceSnapshot(cache, RECENT_SCOPE, [transaction("older", 100), transaction("edited", 200)], false, 1);

    const next = updateTransaction(
      cache,
      { ...transaction("edited", 300), title: "updated" },
      2,
    );

    expect(next.entities.edited.transaction).toMatchObject({
      id: "edited",
      title: "updated",
      date: 300,
    });
    expect(readSnapshot(next, HISTORY_SCOPE).transactions.map(({ id }) => id)).toEqual([
      "edited",
      "older",
    ]);
    expect(readSnapshot(next, RECENT_SCOPE).transactions.map(({ id }) => id)).toEqual([
      "edited",
      "older",
    ]);
  });

  it("reconciles cached IDs by updating survivors and removing absent transactions", () => {
    let cache = replaceSnapshot(
      createCache("account-1"),
      HISTORY_SCOPE,
      [transaction("deleted", 200), transaction("survives", 100)],
      false,
      1,
    );
    cache = replaceSnapshot(
      cache,
      pipeScope(["pipe-1"]),
      [transaction("deleted", 200), transaction("survives", 100)],
      false,
      1,
    );

    const survivor = {
      ...transaction("survives", 300),
      fromIcon: "deleted-icon",
    };
    const next = reconcileTransactions(cache, ["deleted", "survives"], [survivor], 2);

    expect(next.entities.deleted).toBeUndefined();
    expect(next.entities.survives.transaction).toMatchObject({
      id: "survives",
      date: 300,
      fromIcon: "deleted-icon",
    });
    expect(readSnapshot(next, HISTORY_SCOPE).transactions.map(({ id }) => id)).toEqual([
      "survives",
    ]);
    expect(readSnapshot(next, pipeScope(["pipe-1"])).transactions.map(({ id }) => id)).toEqual([
      "survives",
    ]);
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

  it("rejects a persisted transaction entity without an id", () => {
    const malformed = {
      ...createCache("account-1"),
      entities: {
        undefined: {
          transaction: {
            createdAt: 1,
            title: "coffee",
            value: -100,
            date: 1,
            kind: "expense",
          },
          lastAccessedAt: 1,
        },
      },
      snapshots: {
        [HISTORY_SCOPE]: { ids: ["undefined"], updatedAt: 1, hasMore: false },
      },
    };

    expect(deserializeCache(JSON.stringify(malformed), "account-1")).toBeNull();
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
