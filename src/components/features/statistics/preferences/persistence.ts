import { monthlyCardStorage } from "./storage";

export async function loadShowInMain(accountKey: string): Promise<boolean> {
  try {
    const raw = await monthlyCardStorage.read(accountKey);
    const value: unknown = raw === null ? true : JSON.parse(raw);
    return typeof value === "boolean" ? value : true;
  } catch {
    return true;
  }
}

export async function saveShowInMain(accountKey: string, value: boolean): Promise<void> {
  try {
    await monthlyCardStorage.write(accountKey, JSON.stringify(value));
  } catch {
    // A failed preference write must not block the current session's changes.
  }
}
