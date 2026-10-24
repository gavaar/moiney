import { beforeEach, describe, expect, it, vi } from "vitest";
import { eventHistoryStorage } from "@features/transactions/cache/storage.native";
import { pipeViewStorage } from "@features/pipes/preferences/storage.native";
import { monthlyCardStorage } from "@features/statistics/preferences/storage.native";

const filesystem = vi.hoisted(() => ({
  files: new Map<string, string>(),
  directories: new Set<string>(),
  completeWrite: undefined as (() => void) | undefined,
  rejectWrite: undefined as ((error: Error) => void) | undefined,
}));

vi.mock("expo-file-system", () => ({
  Paths: { cache: "cache", document: "documents" },
  Directory: class {
    uri: string;
    constructor(root: string, ...parts: string[]) { this.uri = [root, ...parts].join("/"); }
    create() { filesystem.directories.add(this.uri); }
  },
  File: class {
    uri: string;
    directory: string;
    constructor(directory: { uri: string }, name: string) {
      this.directory = directory.uri;
      this.uri = `${directory.uri}/${name}`;
    }
    get exists() { return filesystem.files.has(this.uri); }
    async text() { return filesystem.files.get(this.uri) ?? ""; }
    write(value: string) {
      return new Promise<void>((resolve, reject) => {
        filesystem.completeWrite = () => {
          if (!filesystem.directories.has(this.directory)) return reject(new Error("Missing directory"));
          filesystem.files.set(this.uri, value);
          resolve();
        };
        filesystem.rejectWrite = reject;
        queueMicrotask(() => filesystem.completeWrite?.());
      });
    }
    delete() { filesystem.files.delete(this.uri); }
  },
}));

beforeEach(() => {
  filesystem.files.clear();
  filesystem.directories.clear();
  filesystem.completeWrite = undefined;
  filesystem.rejectWrite = undefined;
});

describe.each([
  { name: "event history", storage: eventHistoryStorage, directory: "cache/moiney/transactions", accountKey: "event-history:deployment:alice" },
  { name: "pipe views", storage: pipeViewStorage, directory: "documents/moiney/pipe-views", accountKey: "deployment:alice" },
  { name: "monthly card", storage: monthlyCardStorage, directory: "documents/moiney/monthly-card", accountKey: "deployment:alice" },
])("$name native persistence", ({ storage, directory, accountKey }) => {
  const path = `${directory}/${encodeURIComponent(accountKey)}.json`;

  it("reads existing files from the shipped location without creating directories", async () => {
    filesystem.files.set(path, "saved value");
    expect(await storage.read(accountKey)).toBe("saved value");
    expect(filesystem.directories.size).toBe(0);
  });

  it("writes to the same location and isolates accounts", async () => {
    await storage.write(accountKey, "new value");
    expect(filesystem.files.get(path)).toBe("new value");
    expect(await storage.read(accountKey)).toBe("new value");
    expect(await storage.read("deployment:bob")).toBeNull();
  });

  it("waits for asynchronous device writes before reporting completion", async () => {
    const microtask = vi.spyOn(globalThis, "queueMicrotask").mockImplementation(() => {});
    try {
      let finished = false;
      const writing = storage.write(accountKey, "saved value").then(() => { finished = true; });
      await Promise.resolve();
      expect(finished).toBe(false);
      filesystem.completeWrite?.();
      await writing;
      expect(filesystem.files.get(path)).toBe("saved value");
    } finally {
      microtask.mockRestore();
    }
  });

  it("treats asynchronous device write failures as best effort", async () => {
    const microtask = vi.spyOn(globalThis, "queueMicrotask").mockImplementation(() => {});
    try {
      const writing = storage.write(accountKey, "saved value");
      const handled = expect(writing).resolves.toBeUndefined();
      filesystem.rejectWrite?.(new Error("Device storage unavailable"));
      await handled;
      expect(filesystem.files.has(path)).toBe(false);
    } finally {
      microtask.mockRestore();
    }
  });
});

it("clears history without deleting durable preferences", async () => {
  await eventHistoryStorage.write("event-history:deployment:alice", "history");
  await pipeViewStorage.write("deployment:alice", "pipes");
  await monthlyCardStorage.write("deployment:alice", "false");
  await eventHistoryStorage.remove("event-history:deployment:alice");
  expect(await eventHistoryStorage.read("event-history:deployment:alice")).toBeNull();
  expect(await pipeViewStorage.read("deployment:alice")).toBe("pipes");
  expect(await monthlyCardStorage.read("deployment:alice")).toBe("false");
});
