import { File } from "expo-file-system";
import { pipeViewPreferencesDirectory } from "@/lib/storage/directories.native";
import type { PipeViewStorage } from "./usePipeViewPreferences";

function fileFor(accountKey: string) {
  return new File(pipeViewPreferencesDirectory, `${encodeURIComponent(accountKey)}.json`);
}

export const pipeViewStorage: PipeViewStorage = {
  async read(accountKey) {
    try {
      const file = fileFor(accountKey);
      return file.exists ? await file.text() : null;
    } catch {
      return null;
    }
  },
  async write(accountKey, value) {
    try {
      pipeViewPreferencesDirectory.create({ idempotent: true, intermediates: true });
      fileFor(accountKey).write(value);
    } catch {
      // Display preferences should not prevent navigation.
    }
  },
};
