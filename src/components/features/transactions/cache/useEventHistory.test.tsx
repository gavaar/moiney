// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "../history/event-groups";
import { TransactionCacheProvider, useTransactionCache } from "./TransactionCacheContext";
import type { TransactionCacheStorage } from "./TransactionCacheStore";
import { EventHistoryStore } from "./EventHistoryStore";
import { useEventHistory } from "./useEventHistory";

const mocks = vi.hoisted(() => ({ query: vi.fn(), accountKey: "alice" as string | null }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: mocks.accountKey }) }));
const entry = (id: string, date = 1): HistoryEntry => ({ id: id as Id<"events">, operationId: id as Id<"events">, pipeId: "source" as Id<"pipes">, createdAt: date, occurredAt: date, title: "lunch", type: "transaction", value: -100 });
function storage(): TransactionCacheStorage {
  const values = new Map<string, string>();
  return { read: async key => values.get(key) ?? null, write: async (key, value) => { values.set(key, value); }, remove: async key => { values.delete(key); } };
}
function mount(disk: TransactionCacheStorage, options: { enabled?: boolean; minimumCachedRows?: number } = {}) {
  return renderHook(() => useEventHistory(options), { wrapper: ({ children }) => <TransactionCacheProvider storage={disk}>{children}</TransactionCacheProvider> });
}

describe("unfiltered event History cache loader", () => {
  beforeEach(() => { mocks.query.mockReset(); mocks.accountKey = "alice"; });

  it("uses hydrated raw event entries without a server request and preserves mirror identities", async () => {
    const disk = storage();
    const seed = new EventHistoryStore("alice", disk);
    await seed.hydrate();
    await seed.mergeHead([entry("logical"), { ...entry("payment"), operationId: "logical" as Id<"events"> }], false);
    const { result } = mount(disk);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries.map(event => event.id)).toEqual(["payment", "logical"]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("seeds 100 entries then appends 30-entry pages, persisting exhaustion for the next app open", async () => {
    const disk = storage();
    const head = Array.from({ length: 100 }, (_, i) => entry(`head-${i}`, 200 - i));
    mocks.query.mockResolvedValueOnce({ events: head, cursor: "tail", isDone: false }).mockResolvedValueOnce({ events: [entry("tail", 1)], cursor: null, isDone: true });
    const view = mount(disk);
    await waitFor(() => expect(view.result.current.entries).toHaveLength(100));
    expect(mocks.query.mock.calls[0][1]).toEqual({ limit: 100 });
    act(() => view.result.current.loadMore());
    await waitFor(() => expect(view.result.current.entries).toHaveLength(101));
    expect(mocks.query.mock.calls[1][1]).toEqual({ limit: 30, cursor: "tail" });
    expect(view.result.current.hasMore).toBe(false);
    view.unmount();
    const next = mount(disk);
    await waitFor(() => expect(next.result.current.isLoading).toBe(false));
    expect(next.result.current.entries).toHaveLength(101);
    expect(mocks.query).toHaveBeenCalledTimes(2);
  });

  it("does not seed missing History for a disabled feed-ordering consumer", async () => {
    const { result } = mount(storage(), { enabled: false });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("loads server entries when shared device storage is unavailable", async () => {
    const disk = storage();
    disk.read = async () => { throw new Error("unavailable"); };
    disk.write = async () => { throw new Error("full"); };
    mocks.query.mockResolvedValue({ events: [entry("server")], cursor: null, isDone: true });
    const { result } = mount(disk);
    await waitFor(() => expect(result.current.entries.map(event => event.id)).toEqual(["server"]));
    expect(result.current.error).toBeNull();
  });

  it("refreshes an already-loaded event snapshot through explicit history invalidation", async () => {
    const disk = storage();
    const seed = new EventHistoryStore("alice", disk);
    await seed.hydrate();
    await seed.mergeHead([entry("old")], false, 1);
    mocks.query.mockResolvedValue({ events: [entry("new")], cursor: null, isDone: true });
    const { result } = renderHook(() => {
      const cache = useTransactionCache();
      return { history: useEventHistory({ enabled: cache.eventHistory.updatedAt > 0 }), invalidate: cache.invalidateHistory };
    }, { wrapper: ({ children }) => <TransactionCacheProvider storage={disk}>{children}</TransactionCacheProvider> });
    await waitFor(() => expect(result.current.history.entries.map(event => event.id)).toEqual(["old"]));
    expect(mocks.query).not.toHaveBeenCalled();
    await act(async () => { await result.current.invalidate(); });
    await waitFor(() => expect(result.current.history.entries.map(event => event.id)).toEqual(["new"]));
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("reseeds a mounted ranking consumer when main History evicts its cached head", async () => {
    const disk = storage();
    const seed = new EventHistoryStore("alice", disk);
    await seed.hydrate();
    const head = Array.from({ length: 100 }, (_, i) => entry(`head-${i}`, 1000 - i));
    await seed.mergeHead(head, true, 1);
    mocks.query.mockResolvedValue({ events: head, cursor: "more", isDone: false });
    const tail = Array.from({ length: 201 }, (_, i) => entry(`tail-${i}`, 500 - i));
    const { result } = renderHook(() => {
      const cache = useTransactionCache();
      return { history: useEventHistory(), append: () => cache.appendEventHistory(tail, false, cache.eventHistory.generation) };
    }, { wrapper: ({ children }) => <TransactionCacheProvider storage={disk}>{children}</TransactionCacheProvider> });
    await waitFor(() => expect(result.current.history.entries).toEqual(head));
    expect(mocks.query).not.toHaveBeenCalled();
    await act(async () => { await result.current.append(); });
    await waitFor(() => expect(result.current.history.entries).toEqual(head));
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("rejects a pre-mutation read while mutation persistence is still pending", async () => {
    const disk = storage();
    let finishRead!: (page: { events: HistoryEntry[]; cursor: null; isDone: true }) => void;
    mocks.query.mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve; }))
      .mockResolvedValue({ events: [entry("authoritative")], cursor: null, isDone: true });
    let finishMutation!: () => void;
    let holdNextWrite = true;
    const write = disk.write;
    disk.write = (key, value) => {
      if (key !== "event-history:alice" || !holdNextWrite) return write(key, value);
      holdNextWrite = false;
      return new Promise<void>(resolve => {
        finishMutation = () => { void write(key, value).then(resolve); };
      });
    };
    const { result } = renderHook(() => {
      const cache = useTransactionCache();
      return { history: useEventHistory(), invalidate: cache.invalidateHistory };
    }, { wrapper: ({ children }) => <TransactionCacheProvider storage={disk}>{children}</TransactionCacheProvider> });
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    let mutation!: Promise<void>;
    act(() => { mutation = result.current.invalidate(); });
    await act(async () => finishRead({ events: [entry("stale")], cursor: null, isDone: true }));
    expect(result.current.history.entries).toEqual([]);
    await act(async () => { finishMutation(); await mutation; });
    await waitFor(() => expect(result.current.history.entries.map(event => event.id)).toEqual(["authoritative"]));
  });

  it("refreshes an insufficient cached head without losing previously loaded entries", async () => {
    const disk = storage();
    const seed = new EventHistoryStore("alice", disk);
    await seed.hydrate();
    await seed.mergeHead([entry("tail", 1)], true, 1);
    mocks.query.mockResolvedValue({ events: Array.from({ length: 100 }, (_, i) => entry(`head-${i}`, 200 - i)), cursor: "more", isDone: false });
    const { result } = mount(disk, { minimumCachedRows: 100 });
    await waitFor(() => expect(result.current.entries).toHaveLength(101));
    expect(result.current.entries.at(-1)?.id).toBe("tail");
    expect(mocks.query).toHaveBeenCalledTimes(1);
  });

  it("blocks automatic load-more retries after failure and recovers on explicit refresh", async () => {
    mocks.query.mockResolvedValueOnce({ events: [entry("one")], cursor: "more", isDone: false }).mockRejectedValueOnce(new Error("offline"));
    const { result } = mount(storage(), { minimumCachedRows: 0 });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    act(() => result.current.loadMore());
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(result.current.entries).toHaveLength(1);
    mocks.query.mockResolvedValueOnce({ events: [entry("new", 2)], cursor: null, isDone: true });
    act(() => result.current.refresh());
    await waitFor(() => expect(result.current.entries.map(event => event.id)).toEqual(["new"]));
    expect(result.current.error).toBeNull();
  });

  it("discards an in-flight response after account change without exposing or persisting retired entries", async () => {
    let finish!: (value: { events: HistoryEntry[]; cursor: null; isDone: true }) => void;
    mocks.query.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ events: [entry("bob")], cursor: null, isDone: true });
    const disk = storage();
    const { result, rerender } = mount(disk);
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(1));
    mocks.accountKey = "bob";
    rerender();
    expect(result.current.entries).toEqual([]);
    await waitFor(() => expect(result.current.entries.map(event => event.id)).toEqual(["bob"]));
    await act(async () => finish({ events: [entry("alice")], cursor: null, isDone: true }));
    expect(result.current.entries.map(event => event.id)).toEqual(["bob"]);
    const old = new EventHistoryStore("alice", disk);
    await old.hydrate();
    expect(old.read().complete).toBe(false);
  });

  it("treats stalled cursors and empty unfiltered pages as exhaustion", async () => {
    mocks.query.mockResolvedValueOnce({ events: [entry("one")], cursor: "same", isDone: false }).mockResolvedValueOnce({ events: [], cursor: "same", isDone: false });
    const { result } = mount(storage(), { minimumCachedRows: 0 });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.hasMore).toBe(false));
    expect(result.current.error).toBeNull();
  });
});
