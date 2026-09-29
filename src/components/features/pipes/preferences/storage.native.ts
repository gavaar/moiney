import { Directory, File, Paths } from "expo-file-system";
import type { PipeViewStorage } from "./usePipeViewPreferences";

const directory = new Directory(Paths.document, "moiney", "pipe-views");

function fileFor(accountKey: string) {
  return new File(directory, `${encodeURIComponent(accountKey)}.json`);
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
      directory.create({ idempotent: true, intermediates: true });
      fileFor(accountKey).write(value);
    } catch {
      // Display preferences should not prevent navigation.
    }
  },
};
