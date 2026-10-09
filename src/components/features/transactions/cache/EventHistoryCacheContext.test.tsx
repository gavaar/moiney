// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "../history/event-groups";
import { EventHistoryCacheProvider, useEventHistoryCache, useOptionalEventHistoryCache } from "./EventHistoryCacheContext";
import { EventHistoryStore, type EventHistoryStorage } from "./EventHistoryStore";

const auth = vi.hoisted(() => ({ accountKey: "alice" as string | null }));
vi.mock("@/lib/auth", () => ({ useAuth: () => auth }));
const entry = (id: string): HistoryEntry => ({ id: id as Id<"events">, operationId: id as Id<"events">, pipeId: "source" as Id<"pipes">, createdAt: 1, occurredAt: 1, type: "transaction", title: "lunch", value: -100 });
function storage() {
  const values = new Map<string, string>();
  return {
    values,
    read: vi.fn(async (key: string) => values.get(key) ?? null),
    write: vi.fn(async (key: string, value: string) => { values.set(key, value); }),
    remove: vi.fn(async (key: string) => { values.delete(key); }),
  };
}
async function seed(disk: EventHistoryStorage, accountKey = "alice") {
  const store = new EventHistoryStore(accountKey, disk);
  await store.mergeHead([entry(accountKey)], false, 1);
}

beforeEach(() => { auth.accountKey = "alice"; });

describe("event History cache ownership", () => {
  it("requires a provider for readers while allowing optional mutation integration", () => {
    expect(() => renderHook(() => useEventHistoryCache())).toThrow("useEventHistoryCache must be used within EventHistoryCacheProvider");
    expect(renderHook(() => useOptionalEventHistoryCache()).result.current).toBeNull();
  });
  it("hydrates only event entries and removes the retired transaction snapshot", async () => {
    const disk = storage();
    await seed(disk);
    disk.values.set("alice", "retired transactions");
    const { result } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    expect(result.current.eventHistory.entries).toEqual([entry("alice")]);
    expect(disk.values.has("alice")).toBe(false);
    expect(disk.read.mock.calls.map(([key]) => key)).toEqual(["event-history:alice"]);
  });

  it("never exposes retired account entries during an account switch", async () => {
    const disk = storage();
    await seed(disk);
    await seed(disk, "bob");
    const observed = vi.fn<(account: string | null, entries: HistoryEntry[]) => void>();
    const { result, rerender } = renderHook(() => {
      const cache = useEventHistoryCache();
      observed(cache.accountKey, cache.eventHistory.entries);
      return cache;
    }, { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.eventHistory.entries).toEqual([entry("alice")]));
    observed.mockClear();
    auth.accountKey = "bob";
    rerender();
    expect(result.current.eventHistory.entries).toEqual([]);
    await waitFor(() => expect(result.current.eventHistory.entries).toEqual([entry("bob")]));
    expect(observed.mock.calls.every(([account, entries]) => account === "bob" && entries.every(event => event.id !== "alice"))).toBe(true);
    await waitFor(() => expect(disk.values.has("event-history:alice")).toBe(false));
  });

  it("publishes invalidation before device persistence completes and rejects the old generation", async () => {
    const disk = storage();
    await seed(disk);
    const { result } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    const generation = result.current.eventHistory.generation;
    let finish!: () => void;
    disk.write.mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      finish = () => { disk.values.set(key, value); resolve(); };
    }));
    let persisted!: Promise<void>;
    act(() => { persisted = result.current.invalidateHistory(); });
    expect(result.current.eventHistory).toMatchObject({ entries: [], complete: false, generation: generation + 1 });
    expect(result.current.mutationVersion).toBe(1);
    await act(async () => result.current.mergeEventHead([entry("stale")], false, generation));
    expect(result.current.eventHistory.entries).toEqual([]);
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    await act(async () => { finish(); await persisted; });
  });

  it("publishes invalidation even when device writes fail", async () => {
    const disk = storage();
    await seed(disk);
    const { result } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    disk.write.mockRejectedValue(new Error("full"));
    await act(async () => result.current.invalidateHistory());
    expect(result.current.eventHistory).toMatchObject({ entries: [], complete: false, generation: 1 });
    expect(result.current.mutationVersion).toBe(1);
  });

  it.each(["mergeEventHead", "appendEventHistory"] as const)("does not publish a retired account's delayed %s persistence", async operation => {
    const disk = storage();
    await seed(disk);
    await seed(disk, "bob");
    const { result, rerender } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    let finish!: () => void;
    disk.write.mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      finish = () => { disk.values.set(key, value); resolve(); };
    }));
    let persisted!: Promise<void>;
    act(() => { persisted = result.current[operation]([entry("retired")], false, result.current.eventHistory.generation); });
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    auth.accountKey = "bob";
    rerender();
    await waitFor(() => expect(result.current.eventHistory.entries).toEqual([entry("bob")]));
    await act(async () => { finish(); await persisted; });
    expect(result.current.eventHistory.entries).toEqual([entry("bob")]);
    await waitFor(() => expect(disk.values.has("event-history:alice")).toBe(false));
  });

  it("ignores mutation notifications and writes from retired callbacks", async () => {
    const disk = storage();
    const { result, rerender } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    const retired = result.current;
    auth.accountKey = "bob";
    rerender();
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    await act(async () => {
      await retired.invalidateHistory();
      await retired.mergeEventHead([entry("retired")], false, retired.eventHistory.generation);
    });
    expect(result.current.mutationVersion).toBe(0);
    expect(result.current.eventHistory.entries).toEqual([]);
    expect(disk.values.has("event-history:alice")).toBe(false);
  });

  it("clears the signed-out account after an older write finishes", async () => {
    const disk = storage();
    const { result, rerender } = renderHook(() => useEventHistoryCache(), { wrapper: ({ children }) => <EventHistoryCacheProvider storage={disk}>{children}</EventHistoryCacheProvider> });
    await waitFor(() => expect(result.current.isHydrating).toBe(false));
    let finish!: () => void;
    disk.write.mockImplementationOnce((key, value) => new Promise<void>(resolve => {
      finish = () => { disk.values.set(key, value); resolve(); };
    }));
    let persisted!: Promise<void>;
    act(() => { persisted = result.current.mergeEventHead([entry("alice")], false, 0); });
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    auth.accountKey = null;
    rerender();
    expect(result.current.accountKey).toBeNull();
    expect(result.current.eventHistory.entries).toEqual([]);
    await act(async () => { finish(); await persisted; });
    await waitFor(() => expect(disk.values.size).toBe(0));
  });
});
