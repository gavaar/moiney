import {
  appendSnapshot,
  createCache,
  deserializeCache,
  invalidateSnapshots,
  mergeHeadSnapshot,
  readSnapshot,
  replaceSnapshot,
  serializeCache,
  type TransactionCache,
  type TransactionSnapshotRead,
} from "./transactionSnapshot";
import type { TransactionModel } from "@features/transactions/data/transactions";

export type TransactionCacheStorage = {
  read: (accountKey: string) => Promise<string | null>;
  write: (accountKey: string, value: string) => Promise<void>;
  remove: (accountKey: string) => Promise<void>;
};

export class TransactionCacheStore {
  private cacheValue: TransactionCache;
  private hydrated = false;

  constructor(
    private readonly accountKey: string,
    private readonly storage: TransactionCacheStorage,
  ) {
    this.cacheValue = createCache(accountKey);
  }

  get cache(): TransactionCache {
    if (!this.hydrated) {
      throw new Error("TransactionCacheStore must be hydrated before use");
    }
    return this.cacheValue;
  }

  async hydrate(): Promise<TransactionCache> {
    const serialized = await this.storage.read(this.accountKey);
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
    await this.storage.remove(this.accountKey);
  }

  async invalidateAll(now = Date.now()): Promise<TransactionCache> {
    this.cacheValue = invalidateSnapshots(this.cache, now);
    await this.persist();
    return this.cacheValue;
  }

  private async persist(): Promise<void> {
    await this.storage.write(this.accountKey, serializeCache(this.cacheValue));
  }
}
