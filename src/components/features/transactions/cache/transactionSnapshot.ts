import type { TransactionModel } from "@features/transactions/data/transactions";

export const CACHE_VERSION = 1;
export const MAX_CACHED_TRANSACTIONS = 300;
export const MAX_RECENT_TRANSACTIONS = 30;
export const HISTORY_SCOPE = "history";
export const RECENT_SCOPE = "recent";

type CachedEntity = {
  transaction: TransactionModel;
  lastAccessedAt: number;
};

type CachedSnapshot = {
  ids: string[];
  updatedAt: number;
  hasMore: boolean;
};

export type TransactionCache = {
  version: typeof CACHE_VERSION;
  accountKey: string;
  updatedAt: number;
  entities: Record<string, CachedEntity>;
  snapshots: Record<string, CachedSnapshot>;
};

export type TransactionSnapshotRead = {
  transactions: TransactionModel[];
  complete: boolean;
  hasMore: boolean;
  updatedAt: number;
};

export function createCache(accountKey: string): TransactionCache {
  return {
    version: CACHE_VERSION,
    accountKey,
    updatedAt: 0,
    entities: {},
    snapshots: {},
  };
}

export function pipeScope(pipeIds: readonly string[]): string {
  return `pipes:${[...new Set(pipeIds)].sort().join(",")}`;
}

export function readSnapshot(
  cache: TransactionCache,
  scope: string,
): TransactionSnapshotRead {
  const snapshot = cache.snapshots[scope];
  if (!snapshot) {
    return {
      transactions: [],
      complete: false,
      hasMore: false,
      updatedAt: 0,
    };
  }

  const transactions: TransactionModel[] = [];
  for (const id of snapshot.ids) {
    const entity = cache.entities[id];
    if (entity) transactions.push(entity.transaction);
  }

  return {
    transactions,
    complete: transactions.length === snapshot.ids.length,
    hasMore: snapshot.hasMore,
    updatedAt: snapshot.updatedAt,
  };
}

export function replaceSnapshot(
  cache: TransactionCache,
  scope: string,
  transactions: TransactionModel[],
  hasMore: boolean,
  now: number,
): TransactionCache {
  return writeSnapshot(cache, scope, transactions, hasMore, now, false);
}

export function appendSnapshot(
  cache: TransactionCache,
  scope: string,
  transactions: TransactionModel[],
  hasMore: boolean,
  now: number,
): TransactionCache {
  return writeSnapshot(cache, scope, transactions, hasMore, now, true);
}

export function insertTransaction(
  cache: TransactionCache,
  transaction: TransactionModel,
  now: number,
): TransactionCache {
  const transactionId = String(transaction.id);
  const entities = {
    ...cache.entities,
    [transactionId]: { transaction, lastAccessedAt: now },
  };
  const pipeIds = new Set(
    [transaction.from, transaction.to, transaction.paidFrom]
      .filter((pipeId) => pipeId !== undefined)
      .map(String),
  );
  const snapshots = Object.fromEntries(
    Object.entries(cache.snapshots).map(([scope, snapshot]) => {
      if (!scopeContainsTransaction(scope, pipeIds)) return [scope, snapshot];

      const ids = sortSnapshotIds(
        [...new Set([...snapshot.ids, transactionId])],
        entities,
      );
      return [scope, {
        ...snapshot,
        ids: scope === HISTORY_SCOPE
          ? ids
          : ids.slice(0, MAX_RECENT_TRANSACTIONS),
        updatedAt: now,
      }];
    }),
  );

  return evictIfNeeded({
    ...cache,
    updatedAt: now,
    entities,
    snapshots,
  });
}

export function updateTransaction(
  cache: TransactionCache,
  transaction: TransactionModel,
  now: number,
): TransactionCache {
  const transactionId = String(transaction.id);
  const entities = {
    ...cache.entities,
    [transactionId]: { transaction, lastAccessedAt: now },
  };
  const snapshots = Object.fromEntries(
    Object.entries(cache.snapshots).map(([scope, snapshot]) => {
      if (!snapshot.ids.includes(transactionId)) return [scope, snapshot];

      const ids = sortSnapshotIds(snapshot.ids, entities);
      return [scope, {
        ...snapshot,
        ids: scope === HISTORY_SCOPE
          ? ids
          : ids.slice(0, MAX_RECENT_TRANSACTIONS),
        updatedAt: now,
      }];
    }),
  );

  return evictIfNeeded({
    ...cache,
    updatedAt: now,
    entities,
    snapshots,
  });
}

export function reconcileTransactions(
  cache: TransactionCache,
  knownIds: readonly string[],
  transactions: TransactionModel[],
  now: number,
): TransactionCache {
  const entities = { ...cache.entities };
  const returnedIds = new Set<string>();
  for (const transaction of transactions) {
    const transactionId = String(transaction.id);
    returnedIds.add(transactionId);
    entities[transactionId] = { transaction, lastAccessedAt: now };
  }
  for (const transactionId of knownIds) {
    if (!returnedIds.has(transactionId)) delete entities[transactionId];
  }

  const snapshots = Object.fromEntries(
    Object.entries(cache.snapshots).map(([scope, snapshot]) => {
      const ids = sortSnapshotIds(
        snapshot.ids.filter((id) => entities[id] !== undefined),
        entities,
      );
      return [scope, {
        ...snapshot,
        ids: scope === HISTORY_SCOPE
          ? ids
          : ids.slice(0, MAX_RECENT_TRANSACTIONS),
        updatedAt: now,
      }];
    }),
  );

  return evictIfNeeded({
    ...cache,
    updatedAt: now,
    entities,
    snapshots,
  });
}

export function mergeHeadSnapshot(
  cache: TransactionCache,
  scope: string,
  transactions: TransactionModel[],
  hasMore: boolean,
  now: number,
): TransactionCache {
  const incomingIds = new Set(transactions.map((transaction) => String(transaction.id)));
  const existingIds = cache.snapshots[scope]?.ids ?? [];
  const preservedIds = existingIds.filter((id) => !incomingIds.has(id));
  return writeSnapshot(
    cache,
    scope,
    transactions,
    hasMore,
    now,
    false,
    [...incomingIds, ...preservedIds],
  );
}

export function serializeCache(cache: TransactionCache): string {
  return JSON.stringify(cache);
}

export function deserializeCache(
  serialized: string,
  accountKey: string,
): TransactionCache | null {
  try {
    const parsed: unknown = JSON.parse(serialized);
    if (!isCache(parsed) || parsed.accountKey !== accountKey) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function invalidateSnapshots(
  cache: TransactionCache,
  now: number,
): TransactionCache {
  return {
    ...cache,
    updatedAt: now,
    snapshots: {},
  };
}

function writeSnapshot(
  cache: TransactionCache,
  scope: string,
  transactions: TransactionModel[],
  hasMore: boolean,
  now: number,
  append: boolean,
  explicitIds?: string[],
): TransactionCache {
  const entities = { ...cache.entities };
  for (const transaction of transactions) {
    entities[String(transaction.id)] = {
      transaction,
      lastAccessedAt: now,
    };
  }

  const existingIds = append ? cache.snapshots[scope]?.ids ?? [] : [];
  const ids = explicitIds ?? [
    ...existingIds,
    ...transactions.map((transaction) => String(transaction.id)),
  ];
  const uniqueIds = [...new Set(ids)];

  return evictIfNeeded({
    ...cache,
    updatedAt: now,
    entities,
    snapshots: {
      ...cache.snapshots,
      [scope]: {
        ids: uniqueIds,
        updatedAt: now,
        hasMore,
      },
    },
  });
}

function evictIfNeeded(cache: TransactionCache): TransactionCache {
  const entities = { ...cache.entities };
  while (Object.keys(entities).length > MAX_CACHED_TRANSACTIONS) {
    const [oldestId] = Object.entries(entities).sort(
      ([leftId, left], [rightId, right]) =>
        left.lastAccessedAt - right.lastAccessedAt || leftId.localeCompare(rightId),
    )[0];
    delete entities[oldestId];
  }

  const snapshots = Object.fromEntries(
    Object.entries(cache.snapshots).map(([scope, snapshot]) => [scope, {
      ...snapshot,
      ids: snapshot.ids.filter((id) => entities[id] !== undefined),
    }]),
  );

  return { ...cache, entities, snapshots };
}

function scopeContainsTransaction(scope: string, pipeIds: Set<string>): boolean {
  if (scope === HISTORY_SCOPE || scope === RECENT_SCOPE) return true;
  if (!scope.startsWith("pipes:") || pipeIds.size === 0) return false;

  const scopePipeIds = new Set(scope.slice("pipes:".length).split(","));
  return [...pipeIds].some((pipeId) => scopePipeIds.has(pipeId));
}

function sortSnapshotIds(
  ids: string[],
  entities: Record<string, CachedEntity>,
): string[] {
  return ids.sort((leftId, rightId) => {
    const left = entities[leftId]?.transaction;
    const right = entities[rightId]?.transaction;
    if (!left || !right) return 0;

    return (
      right.date - left.date ||
      right.createdAt - left.createdAt ||
      String(right.id).localeCompare(String(left.id))
    );
  });
}

function isCache(value: unknown): value is TransactionCache {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<TransactionCache>;
  if (
    candidate.version !== CACHE_VERSION ||
    typeof candidate.accountKey !== "string" ||
    typeof candidate.updatedAt !== "number" ||
    !candidate.entities ||
    typeof candidate.entities !== "object" ||
    !candidate.snapshots ||
    typeof candidate.snapshots !== "object"
  ) {
    return false;
  }

  const hasValidEntities = Object.entries(candidate.entities).every(
    ([id, entity]) => {
      if (!entity || typeof entity !== "object") return false;
      const cachedEntity = entity as Partial<CachedEntity>;
      const transaction = cachedEntity.transaction as Partial<TransactionModel> | undefined;
      return (
        typeof cachedEntity.lastAccessedAt === "number" &&
        !!transaction &&
        typeof transaction.id === "string" &&
        transaction.id === id
      );
    },
  );
  if (!hasValidEntities) return false;

  return Object.values(candidate.snapshots).every(
    (snapshot) =>
      !!snapshot &&
      Array.isArray(snapshot.ids) &&
      typeof snapshot.updatedAt === "number" &&
      typeof snapshot.hasMore === "boolean",
  );
}
