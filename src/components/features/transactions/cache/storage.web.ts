import type { TransactionCacheStorage } from "./TransactionCacheStore";

const STORAGE_PREFIX = "moiney:transactions:";

function storageKey(accountKey: string): string {
  return `${STORAGE_PREFIX}${encodeURIComponent(accountKey)}`;
}

export const transactionCacheStorage: TransactionCacheStorage = {
  async read(accountKey) {
    try {
      return localStorage.getItem(storageKey(accountKey));
    } catch {
      return null;
    }
  },
  async write(accountKey, value) {
    try {
      localStorage.setItem(storageKey(accountKey), value);
    } catch {
      // A full or unavailable browser cache should not block server data.
    }
  },
  async remove(accountKey) {
    try {
      localStorage.removeItem(storageKey(accountKey));
    } catch {
      // Cache cleanup is best effort.
    }
  },
};
