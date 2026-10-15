const PREFIX = "moiney:monthly-card:";

export const monthlyCardStorage = {
  async read(accountKey: string): Promise<string | null> {
    try {
      return localStorage.getItem(`${PREFIX}${encodeURIComponent(accountKey)}`);
    } catch {
      return null;
    }
  },
  async write(accountKey: string, value: string): Promise<void> {
    try {
      localStorage.setItem(`${PREFIX}${encodeURIComponent(accountKey)}`, value);
    } catch {
      // Display preferences should not prevent navigation.
    }
  },
};
