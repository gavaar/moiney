import {
  appendSnapshot,
  createCache,
  deserializeCache,
  invalidateSnapshots,
  insertTransaction,
  mergeHeadSnapshot,
  reconcileTransactions,
  readSnapshot,
  replaceSnapshot,
  serializeCache,
  type TransactionCache,
  type TransactionSnapshotRead,
  updateTransaction,
} from "./transactionSnapshot";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { EventHistoryStore } from "./EventHistoryStore";

export type TransactionCacheStorage = {
  read: (accountKey: string) => Promise<string | null>;
  write: (accountKey: string, value: string) => Promise<void>;
  remove: (accountKey: string) => Promise<void>;
};

export class TransactionCacheStore {
  readonly eventHistory: EventHistoryStore;
  private cacheValue: TransactionCache;
  private hydrated = false;

  constructor(
    private readonly accountKey: string,
    private readonly storage: TransactionCacheStorage,
  ) {
    this.cacheValue = createCache(accountKey);
    this.eventHistory = new EventHistoryStore(accountKey, storage);
  }

  get cache(): TransactionCache {
    if (!this.hydrated) {
      throw new Error("TransactionCacheStore must be hydrated before use");
    }
    return this.cacheValue;
  }

  async hydrate(): Promise<TransactionCache> {
    await this.eventHistory.hydrate();
    const serialized = await this.storage.read(this.accountKey).catch(() => null);
    this.cacheValue = serialized
      ? deserializeCache(serialized, this.accountKey) ?? createCache(this.accountKey)
      : createCache(this.accountKey);
    this.hydrated = true;
    return this.cacheValue;
  }

  read(scope: string): TransactionSnapshotRead {
    return readSnapshot(this.cache, scope);
  }

  async replace(
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = replaceSnapshot(
      this.cache,
      scope,
      transactions,
      hasMore,
      now,
    );
    await this.persist();
    return this.cacheValue;
  }

  async append(
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = appendSnapshot(
      this.cache,
      scope,
      transactions,
      hasMore,
      now,
    );
    await this.persist();
    return this.cacheValue;
  }

  async addTransaction(
    transaction: TransactionModel,
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = insertTransaction(this.cache, transaction, now);
    await Promise.all([this.persist(), this.eventHistory.invalidate()]);
    return this.cacheValue;
  }

  async updateTransaction(
    transaction: TransactionModel,
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = updateTransaction(this.cache, transaction, now);
    await Promise.all([this.persist(), this.eventHistory.invalidate()]);
    return this.cacheValue;
  }

  async reconcileTransactions(
    knownIds: readonly string[],
    transactions: TransactionModel[],
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = reconcileTransactions(
      this.cache,
      knownIds,
      transactions,
      now,
    );
    await Promise.all([this.persist(), this.eventHistory.invalidate()]);
    return this.cacheValue;
  }

  async mergeHead(
    scope: string,
    transactions: TransactionModel[],
    hasMore: boolean,
    now = Date.now(),
  ): Promise<TransactionCache> {
    this.cacheValue = mergeHeadSnapshot(
      this.cache,
      scope,
      transactions,
      hasMore,
      now,
    );
    await this.persist();
    return this.cacheValue;
  }

  async clear(): Promise<void> {
    this.cacheValue = createCache(this.accountKey);
    this.hydrated = true;
    await Promise.all([this.storage.remove(this.accountKey), this.eventHistory.clear()]);
  }

  async invalidateAll(now = Date.now()): Promise<TransactionCache> {
    this.cacheValue = invalidateSnapshots(this.cache, now);
    await Promise.all([this.persist(), this.eventHistory.invalidate()]);
    return this.cacheValue;
  }

  private async persist(): Promise<void> {
    await this.storage.write(this.accountKey, serializeCache(this.cacheValue));
  }
}
