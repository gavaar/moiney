import { Directory, File, Paths } from "expo-file-system";
import type { EventHistoryStorage } from "./EventHistoryStore";

const cacheDirectory = new Directory(Paths.cache, "moiney", "transactions");
// Events already live here under event-history:<account>; keep their persisted location.

function cacheFile(accountKey: string): File {
  return new File(cacheDirectory, `${encodeURIComponent(accountKey)}.json`);
}

function ensureDirectory(): void {
  cacheDirectory.create({ idempotent: true, intermediates: true });
}

export const eventHistoryStorage: EventHistoryStorage = {
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
