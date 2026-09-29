import type { PipeViewStorage } from "./usePipeViewPreferences";

const PREFIX = "moiney:pipe-views:";

export const pipeViewStorage: PipeViewStorage = {
  async read(accountKey) {
    try {
      return localStorage.getItem(`${PREFIX}${encodeURIComponent(accountKey)}`);
    } catch {
      return null;
    }
  },
  async write(accountKey, value) {
    try {
      localStorage.setItem(`${PREFIX}${encodeURIComponent(accountKey)}`, value);
    } catch {
      // Display preferences should not prevent navigation.
    }
  },
};
