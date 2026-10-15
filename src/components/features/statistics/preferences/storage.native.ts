import { File } from "expo-file-system";
import { monthlyCardPreferencesDirectory } from "@/lib/storage/directories.native";

const fileFor = (accountKey: string) => new File(monthlyCardPreferencesDirectory, `${encodeURIComponent(accountKey)}.json`);

export const monthlyCardStorage = {
  async read(accountKey: string): Promise<string | null> {
    try {
      const file = fileFor(accountKey);
      return file.exists ? await file.text() : null;
    } catch {
      return null;
    }
  },
  async write(accountKey: string, value: string): Promise<void> {
    try {
      monthlyCardPreferencesDirectory.create({ idempotent: true, intermediates: true });
      fileFor(accountKey).write(value);
    } catch {
      // Display preferences should not prevent navigation.
    }
  },
};
