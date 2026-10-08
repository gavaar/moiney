import { describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "../history/event-groups";
import { EventHistoryStore, type EventHistoryStorage } from "./EventHistoryStore";

function entry(id: string, occurredAt = 1): Extract<HistoryEntry, { type: "transaction" }> {
  return { id: id as Id<"events">, operationId: id as Id<"events">, pipeId: "source" as Id<"pipes">, createdAt: occurredAt, occurredAt, type: "transaction", title: "lunch", value: -100 };
}
function storage(): EventHistoryStorage & { values: Map<string, string> } {
  const values = new Map<string, string>();
  return {
    values,
    read: vi.fn(async key => values.get(key) ?? null),
    write: vi.fn(async (key, value) => { values.set(key, value); }),
    remove: vi.fn(async key => { values.delete(key); }),
  };
}

describe("event History snapshots", () => {
  it("removes the retired transaction key while preserving event snapshots and other accounts", async () => {
    const disk = storage();
    disk.values.set("alice", "legacy transaction cache");
    disk.values.set("bob", "another account's legacy cache");
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    await store.mergeHead([entry("logical"), { ...entry("mirror"), operationId: "logical" as Id<"events"> }], true, 1);
    const next = new EventHistoryStore("alice", disk);
    await next.hydrate();
    expect(next.read()).toMatchObject({ entries: [expect.objectContaining({ id: "mirror" }), expect.objectContaining({ id: "logical" })], complete: true, hasMore: true, updatedAt: 1 });
    expect(disk.values.has("alice")).toBe(false);
    expect(disk.values.get("bob")).toBe("another account's legacy cache");
    const other = new EventHistoryStore("bob", disk);
    await other.hydrate();
    expect(other.read().complete).toBe(false);
  });

  it("refreshes the head without discarding loaded tail entries, deduplicating by entry not operation", async () => {
    const store = new EventHistoryStore("alice", storage());
    await store.hydrate();
    await store.mergeHead([entry("first", 5)], true, 1);
    await store.append([entry("second", 3), entry("third", 1)], false, 2);
    await store.mergeHead([{ ...entry("first", 7), title: "edited" }, entry("new", 9)], true, 3);
    expect(store.read().entries.map(event => event.id)).toEqual(["new", "first", "second", "third"]);
    expect(store.read().entries[1]).toMatchObject({ title: "edited" });
    // A head with more server rows does not undo known full-history exhaustion.
    expect(store.read().hasMore).toBe(false);
  });

  it("caps entries at 300, preserving recently refreshed entries and requiring pagination after eviction", async () => {
    const store = new EventHistoryStore("alice", storage());
    await store.hydrate();
    await store.mergeHead(Array.from({ length: 300 }, (_, i) => entry(`old-${i}`, i)), false, 1);
    await store.mergeHead([entry("old-0", 0)], true, 2);
    await store.append([entry("new", 400)], false, 3);
    expect(store.read().entries).toHaveLength(300);
    expect(store.read().entries.some(event => event.id === "old-0")).toBe(true);
    expect(store.read().entries.some(event => event.id === "new")).toBe(true);
    expect(store.read().hasMore).toBe(true);
  });

  it("requires a fresh head after eviction so Quick Creation cannot rank an older cached window as Latest", async () => {
    const store = new EventHistoryStore("alice", storage());
    await store.hydrate();
    const head = Array.from({ length: 100 }, (_, i) => entry(`head-${i}`, 1000 - i));
    await store.mergeHead(head, true, 1);
    await store.append(Array.from({ length: 201 }, (_, i) => entry(`tail-${i}`, 500 - i)), false, 2);
    expect(store.read().complete).toBe(false);
    await store.append([entry("tail-200", 300)], false, 3);
    expect(store.read().complete).toBe(false);
    await store.mergeHead(head, true, 4);
    expect(store.read()).toMatchObject({ entries: head, complete: true, hasMore: true });
  });

  it("invalidates persisted membership so a changed operation cannot resurrect stale counterparts", async () => {
    const disk = storage();
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    await store.mergeHead([entry("canonical"), entry("removed-mirror")], false, 1);
    await store.invalidate();
    expect(store.read()).toMatchObject({ entries: [], complete: false });
    const next = new EventHistoryStore("alice", disk);
    await next.hydrate();
    expect(next.read().complete).toBe(false);
    await next.mergeHead([entry("canonical")], false, 2);
    expect(next.read().entries.map(event => event.id)).toEqual(["canonical"]);
    await next.clear();
    expect(disk.values.size).toBe(0);
  });

  it("falls back to a cache miss for malformed, incompatible, or wrong-account persisted data", async () => {
    const disk = storage();
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    await store.mergeHead([entry("one")], false, 1);
    const [key, valid] = [...disk.values.entries()][0];
    const data = JSON.parse(valid);
    for (const malformed of ["{", JSON.stringify({ ...data, version: 999 }), JSON.stringify({ ...data, accountKey: "bob" }), JSON.stringify({ ...data, entries: [{ entry: { ...entry("one"), operationId: undefined }, refreshedAt: 1 }] })]) {
      disk.values.set(key, malformed);
      const next = new EventHistoryStore("alice", disk);
      await next.hydrate();
      expect(next.read().complete).toBe(false);
    }
  });

  it("keeps server entries available when reading or writing device storage fails", async () => {
    const disk = storage();
    vi.mocked(disk.read).mockRejectedValue(new Error("unavailable"));
    vi.mocked(disk.write).mockRejectedValue(new Error("full"));
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    await store.mergeHead([entry("one")], false, 1);
    expect(store.read().entries.map(event => event.id)).toEqual(["one"]);
  });

  it("serializes persistence so clearing waits out an older write and leaves no signed-out data", async () => {
    const disk = storage();
    let release!: () => void;
    vi.mocked(disk.write).mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      release = () => { disk.values.set(key, value); resolve(); };
    }));
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    const write = store.mergeHead([entry("one")], false, 1);
    await Promise.resolve();
    const clear = store.clear();
    release();
    await Promise.all([write, clear]);
    expect(disk.values.size).toBe(0);
    expect(store.read().entries).toEqual([]);
  });

  it.each(["invalidate", "clear"] as const)("does not restore stale hydration after %s", async operation => {
    const disk = storage();
    const seed = new EventHistoryStore("alice", disk);
    await seed.mergeHead([entry("stale")], false, 1);
    const serialized = disk.values.get("event-history:alice")!;
    let finishRead!: (value: string) => void;
    vi.mocked(disk.read).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }));
    const store = new EventHistoryStore("alice", disk);
    const hydration = store.hydrate();
    await vi.waitFor(() => expect(finishRead).toBeTypeOf("function"));
    await store[operation]();
    finishRead(serialized);
    await hydration;
    expect(store.read()).toMatchObject({ entries: [], complete: false, generation: 1 });
  });
});
