// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMixedHistory } from "./use-mixed-history";

const mocks = vi.hoisted(() => ({
  query: vi.fn(), focused: true, accountKey: "alice", cache: {}, pipes: [],
  mutationVersion: 0, mergeHead: vi.fn(), append: vi.fn(),
}));
vi.mock("convex/react", () => ({ useConvex: () => client }));
vi.mock("expo-router/react-navigation", () => ({ useIsFocused: () => mocks.focused }));
vi.mock("../cache/TransactionCacheContext", () => ({ useTransactionCache: () => mocks }));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({ usePipeCatalog: () => ({ allPipes: mocks.pipes }) }));
const client = { query: mocks.query };
const transaction = { id: "tx", title: "hotel", date: 1000, value: -6000, kind: "expense", createdAt: 1000 };
const item = { kind: "transaction", date: 1000, transaction };

describe("mixed History loading", () => {
  beforeEach(() => {
    mocks.query.mockReset();
    mocks.focused = true;
    mocks.accountKey = "alice";
    mocks.cache = {};
    mocks.mutationVersion = 0;
    mocks.mergeHead.mockReset();
    mocks.mergeHead.mockResolvedValue(undefined);
    mocks.append.mockReset();
    mocks.append.mockResolvedValue(undefined);
    mocks.query.mockImplementation(async (_ref, args) => ({
      items: args.source === "transactions" ? [item] : [], cursor: null, isDone: true,
    }));
  });

  it("refreshes on local writes without refetching for snapshot read updates", async () => {
    const { result, rerender } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.query).toHaveBeenCalledTimes(2);
    mocks.cache = { snapshotRead: true };
    rerender();
    expect(mocks.query).toHaveBeenCalledTimes(2);
    mocks.mutationVersion += 1;
    rerender();
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(4));
  });

  it("seeds financial ranking with the raw transaction head, never creation events or archive headers", async () => {
    mocks.query.mockImplementation(async (_ref, args) => ({
      items: args.source === "transactions" ? [item] : [], cursor: null, isDone: true,
      transactionPage: args.source === "transactions" ? { transactions: [transaction], hasMore: false } : undefined,
    }));
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mocks.mergeHead).toHaveBeenCalledWith("history", [transaction], false);
  });

  it("retains loaded history while an explicit refresh is pending", async () => {
    const { result } = renderHook(() => useMixedHistory());
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.query.mockImplementation(() => new Promise(() => {}));
    act(() => result.current.refresh());
    expect(result.current.items).toEqual([item]);
    expect(result.current.isLoading).toBe(true);
  });

  it("fills latest history across compressed archive page boundaries", async () => {
    const older = { ...item, date: 900, transaction: { ...transaction, id: "older", date: 900 } };
    mocks.query.mockImplementation(async (_ref, args) => {
      if (args.source === "events") return { items: [], cursor: null, isDone: true };
      return args.cursor
        ? { items: [older], cursor: null, isDone: true, transactionPage: { transactions: [older.transaction], hasMore: false } }
        : { items: [item], cursor: "next", isDone: false, transactionPage: { transactions: [transaction], hasMore: true } };
    });
    const { result } = renderHook(() => useMixedHistory({}, { recent: true }));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.hasMore).toBe(false);
    expect(mocks.append).toHaveBeenCalledWith("history", [older.transaction], false);
  });

  it("does not read in hidden tabs and never displays another account's results", async () => {
    mocks.focused = false;
    const { result, rerender } = renderHook(() => useMixedHistory());
    expect(mocks.query).not.toHaveBeenCalled();
    mocks.focused = true;
    rerender();
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.accountKey = "bob";
    mocks.query.mockImplementation(() => new Promise(() => {}));
    rerender();
    expect(result.current.items).toEqual([]);
  });

  it("replaces rather than mixes results when date or parent filters change", async () => {
    const { result, rerender } = renderHook(({ fromDate }) => useMixedHistory({ fromDate }), { initialProps: { fromDate: 0 } });
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    mocks.query.mockResolvedValue({ items: [], cursor: null, isDone: true });
    rerender({ fromDate: 2000 });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.items).toEqual([]);
  });
});
