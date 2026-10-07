// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { getFunctionName } from "convex/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "./event-groups";
import { useMixedHistory } from "./use-mixed-history";

const mocks = vi.hoisted(() => ({ query: vi.fn(), focused: true, accountKey: "alice", isHydrating: false,
  eventHistory: { entries: [] as HistoryEntry[], complete: false, hasMore: false, updatedAt: 0, generation: 0 },
  pipes: [], mutationVersion: 0, mergeEventHead: vi.fn(), appendEventHistory: vi.fn() }));
const client = { query: mocks.query };
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => mocks.focused }));
vi.mock("../cache/TransactionCacheContext", () => ({ useTransactionCache: () => mocks }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: mocks.pipes }) }));
const pipe = (id: string) => id as Id<"pipes">;
function expense(id = "expense", pipeId = "source", date = 1000): Extract<HistoryEntry, { type: "transaction" }> {
  return { id: id as Id<"events">, operationId: id as Id<"events">, pipeId: pipe(pipeId), occurredAt: date, createdAt: date, type: "transaction", title: "hotel", value: -6000 };
}
function respond(ref: Parameters<typeof getFunctionName>[0]) {
  return getFunctionName(ref) === "events:deletedPipes"
    ? { events: [], cursor: null, isDone: true } : getFunctionName(ref) === "events:latest"
      ? [expense()] : { events: [expense()], cursor: null, isDone: true };
}

describe("loaded event History", () => {
  beforeEach(() => {
    mocks.query.mockReset().mockImplementation(async ref => respond(ref));
    mocks.focused = true; mocks.accountKey = "alice"; mocks.mutationVersion = 0;
    mocks.eventHistory = { entries: [], complete: false, hasMore: false, updatedAt: 0, generation: 0 };
    mocks.mergeEventHead.mockReset().mockResolvedValue(undefined);
    mocks.appendEventHistory.mockReset().mockResolvedValue(undefined);
  });

  it("loads raw event pages and seeds ranking only for unfiltered main History", async () => {
    const { result, rerender } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.entries).toEqual([expense()]));
    expect(mocks.mergeEventHead).toHaveBeenCalledWith([expense()], false, 0);
    expect(mocks.query.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual(["events:deletedPipes", "events:list"]);
    mocks.eventHistory = { ...mocks.eventHistory, entries: [expense()], complete: true };
    rerender();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    mocks.mutationVersion += 1;
    mocks.eventHistory = { ...mocks.eventHistory, complete: false, generation: 1 };
    rerender();
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(4));
  });

  it("groups only the 30 stored entries returned by Latest and never fills missing operation members", async () => {
    const latest = Array.from({ length: 30 }, (_, i) => expense(`expense-${i}`));
    mocks.query.mockImplementation(async ref => getFunctionName(ref) === "events:latest" ? latest : respond(ref));
    const { result } = renderHook(() => useMixedHistory({}, { recent: true }));
    await waitFor(() => expect(result.current.entries).toHaveLength(30));
    expect(result.current.hasMore).toBe(false);
    act(() => result.current.loadMore());
    expect(mocks.query).toHaveBeenCalledTimes(2);
    expect(mocks.mergeEventHead).not.toHaveBeenCalled();
  });

  it("loads a rare subtree with exactly one indexed Latest query per unique pipe, never scanning unrelated history", async () => {
    const head = Array.from({ length: 20 }, (_, i) => expense(`a-${i}`, "a", 200 - i));
    const tail = Array.from({ length: 10 }, (_, i) => expense(`b-${i}`, "b", 100 - i));
    mocks.query.mockImplementation(async (ref, args) => {
      if (getFunctionName(ref) === "events:deletedPipes") return respond(ref);
      if (getFunctionName(ref) !== "events:latest") throw new Error("Unrelated history scan");
      return args.pipeId === "a" ? head : tail;
    });
    const { result } = renderHook(() => useMixedHistory({ pipeIds: [pipe("a"), pipe("b"), pipe("a")] }, { recent: true }));
    await waitFor(() => expect(result.current.entries).toHaveLength(30));
    expect(mocks.query.mock.calls.slice(1).map(([, args]) => args.pipeId).sort()).toEqual(["a", "b"]);
    expect(result.current.entries).toEqual([...head, ...tail]);
    expect(result.current.hasMore).toBe(false);
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("reuses deletion metadata across pipe selections and refreshes it after a local write", async () => {
    mocks.query.mockImplementation(async (ref, args) => getFunctionName(ref) === "events:deletedPipes" ? respond(ref) : [expense(args.pipeId, args.pipeId)]);
    const { result, rerender } = renderHook(({ selected }) => useMixedHistory({ pipeIds: [pipe(selected)] }, { recent: true }), { initialProps: { selected: "a" } });
    await waitFor(() => expect(result.current.entries).toEqual([expense("a", "a")]));
    rerender({ selected: "b" });
    await waitFor(() => expect(result.current.entries).toEqual([expense("b", "b")]));
    expect(mocks.query.mock.calls.filter(([ref]) => getFunctionName(ref) === "events:deletedPipes")).toHaveLength(1);
    expect(mocks.query).toHaveBeenCalledTimes(3);
    mocks.mutationVersion++;
    rerender({ selected: "b" });
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(5));
    expect(mocks.query.mock.calls.filter(([ref]) => getFunctionName(ref) === "events:deletedPipes")).toHaveLength(2);
  });

  it("merges indexed descendant windows before keeping the newest 30 raw entries", async () => {
    const deletion: HistoryEntry = { id: "deleted-child" as Id<"events">, operationId: "deleted-child" as Id<"events">,
      type: "pipe_deletion", pipeId: pipe("child"), ancestorIds: [pipe("parent")], occurredAt: 9000, createdAt: 9000, name: "Child", icon: "map", pipeType: "pipe" };
    const parent = Array.from({ length: 30 }, (_, i) => expense(`parent-${i}`, "parent", 100 - i * 2));
    const child = Array.from({ length: 30 }, (_, i) => expense(`child-${i}`, "child", 99 - i * 2));
    mocks.query.mockImplementation(async (ref, args) => getFunctionName(ref) === "events:deletedPipes"
      ? { events: [deletion], cursor: null, isDone: true } : args.pipeId === "parent" ? parent : child);
    const { result } = renderHook(() => useMixedHistory({ pipeIds: [pipe("parent")] }, { recent: true }));
    await waitFor(() => expect(result.current.entries).toHaveLength(30));
    expect(result.current.entries.map(entry => entry.id)).toEqual(parent.slice(0, 15).flatMap((entry, i) => [entry.id, child[i].id]));
    expect(mocks.query.mock.calls.slice(1).map(([, args]) => args.pipeId).sort()).toEqual(["child", "parent"]);
    expect(mocks.query).toHaveBeenCalledTimes(3);
  });

  it("bounds concurrent indexed queries and stops scheduling after a scope is retired", async () => {
    const pending: (() => void)[] = [];
    mocks.query.mockImplementation((ref, args) => getFunctionName(ref) === "events:deletedPipes"
      ? Promise.resolve(respond(ref)) : new Promise(resolve => pending.push(() => resolve([expense(args.pipeId, args.pipeId)]))));
    const ids = Array.from({ length: 10 }, (_, i) => pipe(`pipe-${i}`));
    const { unmount } = renderHook(() => useMixedHistory({ pipeIds: ids }, { recent: true }));
    await waitFor(() => expect(pending).toHaveLength(8));
    expect(mocks.query).toHaveBeenCalledTimes(9);
    unmount();
    await act(async () => { pending.forEach(finish => finish()); });
    expect(mocks.query).toHaveBeenCalledTimes(9);
  });

  it("does not truncate loaded main History at the persistent cache's 300-entry limit", async () => {
    let page = 0;
    mocks.query.mockImplementation(async ref => {
      if (getFunctionName(ref) === "events:deletedPipes") return respond(ref);
      const count = page === 0 ? 100 : 30;
      const events = Array.from({ length: count }, (_, i) => expense(`${page}-${i}`, "source", 10000 - page * 100 - i));
      page++;
      return { events, cursor: page === 8 ? null : `page-${page}`, isDone: page === 8 };
    });
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.entries).toHaveLength(100));
    for (let i = 1; i <= 7; i++) {
      act(() => result.current.loadMore());
      await waitFor(() => expect(result.current.entries).toHaveLength(100 + i * 30));
    }
    expect(result.current.hasMore).toBe(false);
  });

  it("uses a hydrated unfiltered snapshot without a financial history request", async () => {
    mocks.eventHistory = { ...mocks.eventHistory, entries: [expense()], complete: true };
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([expense()]);
    expect(mocks.query.mock.calls.map(([ref]) => getFunctionName(ref))).toEqual(["events:deletedPipes"]);
  });

  it("continues past cached overlap so one load-more action reveals the next unseen page", async () => {
    const head = Array.from({ length: 100 }, (_, i) => expense(`head-${i}`, "source", 300 - i));
    const cachedTail = Array.from({ length: 30 }, (_, i) => expense(`cached-${i}`, "source", 100 - i));
    mocks.eventHistory = { ...mocks.eventHistory, entries: [...head, ...cachedTail], complete: true, hasMore: true };
    mocks.query.mockImplementation(async (ref, args) => getFunctionName(ref) === "events:deletedPipes" ? respond(ref)
      : !args.cursor ? { events: head, cursor: "cached", isDone: false }
        : args.cursor === "cached" ? { events: cachedTail, cursor: "unseen", isDone: false }
          : { events: [expense("new", "source", 1)], cursor: null, isDone: true });
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.entries).toHaveLength(130));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.entries).toHaveLength(131));
    expect(result.current.hasMore).toBe(false);
  });

  it("scans sparse selected-parent pages and matches archived descendants from metadata only", async () => {
    const deletion: HistoryEntry = { id: "deleted" as Id<"events">, operationId: "deleted" as Id<"events">, type: "pipe_deletion", pipeId: pipe("child"), ancestorIds: [pipe("parent")], occurredAt: 9000, createdAt: 9000, name: "Deleted child", icon: "map", pipeType: "pipe" };
    mocks.query.mockImplementation(async (ref, args) => getFunctionName(ref) === "events:deletedPipes"
      ? { events: [deletion], cursor: null, isDone: true }
      : args.cursor ? { events: [expense("child", "child")], cursor: null, isDone: true }
        : { events: [expense("outside", "outside")], cursor: "next", isDone: false });
    const { result } = renderHook(() => useMixedHistory({ pipeIds: [pipe("parent")] }));
    await waitFor(() => expect(result.current.entries).toEqual([expense("child", "child")]));
    expect(result.current.deletedPipes).toEqual([deletion]);
    expect(mocks.mergeEventHead).not.toHaveBeenCalled();
  });

  it("loads only main History pages on load-more and retains rows after a failed page", async () => {
    mocks.query.mockImplementation(async ref => getFunctionName(ref) === "events:deletedPipes" ? respond(ref) : { events: [expense()], cursor: "next", isDone: false });
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.hasMore).toBe(true));
    mocks.query.mockRejectedValueOnce(new Error("offline"));
    act(() => result.current.loadMore());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    const count = mocks.query.mock.calls.length;
    act(() => result.current.loadMore());
    expect(mocks.query).toHaveBeenCalledTimes(count);
    expect(result.current.entries).toEqual([expense()]);
  });

  it("keeps loaded rows and metadata visible during explicit refresh", async () => {
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    mocks.query.mockImplementation(() => new Promise(() => {}));
    act(() => result.current.refresh());
    expect(result.current.entries).toEqual([expense()]);
    expect(result.current.isRefreshing).toBe(true);
  });

  it("pauses collapsed/hidden views and drops a retired account's pending result", async () => {
    mocks.focused = false;
    const { result, rerender } = renderHook(({ enabled }) => useMixedHistory({}, { recent: true, enabled }), { initialProps: { enabled: false } });
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.focused = true;
    rerender({ enabled: true });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    rerender({ enabled: false });
    mocks.mutationVersion++;
    rerender({ enabled: false });
    expect(mocks.query).toHaveBeenCalledTimes(2);
    mocks.accountKey = "bob";
    mocks.query.mockImplementation(() => new Promise(() => {}));
    rerender({ enabled: true });
    expect(result.current.entries).toEqual([]);
    expect(result.current.deletedPipes).toEqual([]);
  });

  it("replaces rows when filters change and never persists filtered History as an unfiltered snapshot", async () => {
    const { result, rerender } = renderHook(({ fromDate }) => useMixedHistory({ fromDate, title: "hotel" }), { initialProps: { fromDate: 0 } });
    await waitFor(() => expect(result.current.entries).toHaveLength(1));
    expect(mocks.query.mock.calls[1][1]).toMatchObject({ fromDate: 0, title: "hotel" });
    expect(mocks.mergeEventHead).not.toHaveBeenCalled();
    mocks.query.mockImplementation(async () => ({ events: [], cursor: null, isDone: true }));
    rerender({ fromDate: 2000 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.entries).toEqual([]);
  });
});
