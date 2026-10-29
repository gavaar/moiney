import { File } from "expo-file-system";
import { eventHistoryCacheDirectory } from "@/lib/storage/directories.native";
import type { EventHistoryStorage } from "./EventHistoryStore";

function cacheFile(accountKey: string): File {
  return new File(eventHistoryCacheDirectory, `${encodeURIComponent(accountKey)}.json`);
}

function ensureDirectory(): void {
  eventHistoryCacheDirectory.create({ idempotent: true, intermediates: true });
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
      await cacheFile(accountKey).write(value);
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
