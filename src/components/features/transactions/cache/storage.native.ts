import { Directory, File, Paths } from "expo-file-system";
import type { TransactionCacheStorage } from "./TransactionCacheStore";

const cacheDirectory = new Directory(Paths.cache, "moiney", "transactions");

function cacheFile(accountKey: string): File {
  return new File(cacheDirectory, `${encodeURIComponent(accountKey)}.json`);
}

function ensureDirectory(): void {
  cacheDirectory.create({ idempotent: true, intermediates: true });
}

export const transactionCacheStorage: TransactionCacheStorage = {
  async read(accountKey) {
    try {
      const file = cacheFile(accountKey);
      return file.exists ? await file.text() : null;
    } catch {
      return null;
    }
  },
  async write(accountKey, value) {
    try {
      ensureDirectory();
      cacheFile(accountKey).write(value);
    } catch {
      // A full or unavailable device cache should not block server data.
    }
  },
  async remove(accountKey) {
    try {
      const file = cacheFile(accountKey);
      if (file.exists) file.delete();
    } catch {
      // Cache cleanup is best effort.
    }
  },
};
