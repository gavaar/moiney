// @vitest-environment jsdom
import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PipesScreen } from "./PipesScreen";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  remove: vi.fn(),
  selectPipe: vi.fn(),
  deselectPipe: vi.fn(),
  addTabListener: vi.fn(),
  removeTabListener: vi.fn(),
  selectedPipePath: [] as string[],
  selectedName: null as string | null,
  useFocusEffect: vi.fn(),
  focusEffect: undefined as undefined | (() => void | (() => void)),
  feeds: [] as any[],
  allPipes: [] as any[],
  historyEntries: [] as any[],
  historySnapshot: {
    entries: [] as any[],
    complete: true,
    hasMore: false,
    updatedAt: 1,
  },
  historyOptions: undefined as any,
  historyMounts: vi.fn(),
}));

vi.mock("react-native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native")>()),
  BackHandler: { addEventListener: mocks.addEventListener },
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("expo-router/react-navigation", () => ({
  useFocusEffect: mocks.useFocusEffect,
  useIsFocused: () => true,
}));
vi.mock("expo-router", () => ({
  useNavigation: () => ({ getParent: () => ({
    addListener: mocks.addTabListener,
    getState: () => ({ routes: [{ name: "pipes", key: "pipes-key" }, { name: "history", key: "history-key" }] }),
  }) }),
}));

vi.mock("@features/app/AppScreenHeader", () => ({
  AppScreenHeader: ({ right }: { right: React.ReactNode }) => <div>{right}</div>,
}));
vi.mock("@ui/SlideToggle", () => ({
  SlideToggle: ({ onChange, value }: { onChange: (v: string) => void; value: string }) => (
    <button
      data-testid="mode-toggle"
      onClick={() => onChange(value === "tree" ? "bar" : "tree")}
    />
  ),
}));
vi.mock("@features/pipes/InnerPipesScreen", () => ({
  InnerPipesScreen: () => null,
}));
vi.mock("@features/pipes/PipeTreeView", () => ({ PipeTreeView: () => null }));
vi.mock("@features/pipes/FeedListScreen", () => ({
  FeedListScreen: ({ pipes }: any) => (
    <div data-testid="feed-order">{pipes.map((pipe: any) => pipe.id).join(",")}</div>
  ),
}));
vi.mock("@features/transactions/components/TransactionList", () => ({
  TransactionList: () => <div data-testid="latest-list" />,
}));
vi.mock("@features/transactions/history/mixed-history-feed", () => ({
  MixedHistoryFeed: ({ filters, recent, enabled }: { filters?: { pipeIds?: string[] }; recent?: boolean; enabled?: boolean }) => {
    useEffect(() => { mocks.historyMounts(); }, []);
    return <div data-testid="latest-list" data-pipe-ids={filters?.pipeIds?.join(",")} data-recent={String(recent)} data-enabled={String(enabled)} />;
  },
}));
vi.mock("@features/statistics/CurrentMonthReportContext", () => ({
  useCurrentMonthReportContext: () => ({ report: {
      periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 600, refundCents: 0,
      offenders: [{ pipeId: "leaf", name: "Groceries", netSpendingCents: 600, capacityCents: 400, overageCents: 200 }],
    } }),
}));
vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => (
    <span data-testid={testID ?? "icon"} data-icon-name={name} />
  ),
  safeIconName: (name: string) => name,
}));
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({
  useTransactionCache: () => ({
    cache: {},
    read: () => mocks.historySnapshot,
    eventHistory: mocks.historySnapshot,
  }),
}));
vi.mock("@features/transactions/cache/useEventHistory", () => ({
  useEventHistory: (options: unknown) => {
    mocks.historyOptions = options;
    return { entries: mocks.historyEntries, isLoading: false };
  },
}));
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    feeds: [],
    isLoading: false,
    selectedName: mocks.selectedName,
    selectedPipePath: mocks.selectedPipePath,
    selectPipe: mocks.selectPipe,
    deselectPipe: mocks.deselectPipe,
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    feeds: mocks.feeds,
    allPipes: mocks.allPipes,
    childrenByParent: new Map(mocks.allPipes.reduce((entries: [string, any[]][], pipe: any) => {
      if (pipe.parentId) {
        const entry = entries.find(([id]) => id === pipe.parentId);
        if (entry) entry[1].push(pipe);
        else entries.push([pipe.parentId, [pipe]]);
      }
      return entries;
    }, [])),
    isLoading: false,
  }),
}));

describe("Pipes Android back handling", () => {
  it("opens the current ancestor path when navigating from a creation event", async () => {
    mocks.allPipes = [
      { id: "root", name: "Travel" },
      { id: "child", name: "Madrid", parentId: "root" },
    ];
    const onPipeOpened = vi.fn();
    render(<PipesScreen openPipeId="child" onPipeOpened={onPipeOpened} />);
    await waitFor(() => expect(mocks.selectPipe).toHaveBeenCalledWith(["root", "child"]));
    expect(onPipeOpened).toHaveBeenCalledOnce();
  });
  it("resets collapsed history and tree mode when a deep link opens a pipe", async () => {
    const user = userEvent.setup();
    mocks.allPipes = [{ id: "root", name: "Travel" }, { id: "other", name: "Savings" }];
    mocks.selectedPipePath = ["root"];
    mocks.selectedName = "Travel";
    const { rerender } = render(<PipesScreen />);

    await user.click(screen.getByRole("button", { name: "Collapse latest transactions" }));
    rerender(<PipesScreen openPipeId="root" />);
    expect(screen.getByRole("button", { name: "Collapse latest transactions" })).toBeDefined();

    await user.click(screen.getByTestId("mode-toggle"));
    expect(screen.queryByText("Latest transactions")).toBeNull();
    mocks.allPipes = [{ id: "root", name: "Travel" }];
    rerender(<PipesScreen openPipeId="other" />);
    expect(screen.queryByText("Latest transactions")).toBeNull();
    mocks.allPipes = [{ id: "root", name: "Travel" }, { id: "other", name: "Savings" }];
    rerender(<PipesScreen openPipeId="other" />);
    expect(screen.getByRole("button", { name: "Collapse latest transactions" })).toBeDefined();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedPipePath = [];
    mocks.selectedName = null;
    mocks.feeds = [];
    mocks.allPipes = [];
    mocks.historyEntries = [];
    mocks.historySnapshot = {
      entries: [],
      complete: true,
      hasMore: false,
      updatedAt: 1,
    };
    mocks.historyOptions = undefined;
    mocks.addEventListener.mockReturnValue({ remove: mocks.remove });
    mocks.addTabListener.mockReturnValue(mocks.removeTabListener);
    mocks.useFocusEffect.mockImplementation((effect) => {
      mocks.focusEffect = effect;
    });
  });

  it("orders FeedListScreen roots by cached History tree usage", () => {
    const feedA = {
      id: "feed-a",
      name: "A",
      icon: "cash-outline",
      priority: 0,
      capacity: 1000,
      fed: 2000,
      spent: 0,
    };
    const feedB = { ...feedA, id: "feed-b", name: "B", fed: 1000 };
    const childA = { ...feedA, id: "child-a", parentId: feedA.id };
    const childB = { ...feedB, id: "child-b", parentId: feedB.id };
    mocks.feeds = [feedA, feedB];
    mocks.allPipes = [feedA, feedB, childA, childB];
    mocks.historyEntries = [
      { id: "tx-1", operationId: "tx-1", type: "transaction", pipeId: childB.id, occurredAt: 3, createdAt: 3, title: "lunch", value: -100 },
      { id: "tx-2", operationId: "tx-2", type: "transaction", pipeId: childA.id, occurredAt: 2, createdAt: 2, title: "lunch", value: -100 },
      { id: "tx-3", operationId: "tx-3", type: "transaction", pipeId: childB.id, occurredAt: 1, createdAt: 1, title: "lunch", value: -100 },
    ];

    render(<PipesScreen />);

    expect(screen.getByTestId("feed-order").textContent).toBe("feed-b,feed-a");
    expect(mocks.historyOptions).toEqual({
      enabled: true,
      minimumCachedRows: 100,
    });
  });

  it("collapses mirror entries before ranking feed trees", () => {
    const a = { id: "a", name: "A", fed: 2000 };
    const b = { id: "b", name: "B", fed: 1000 };
    const c = { id: "c", name: "C", fed: 500 };
    mocks.feeds = [b, c, a];
    mocks.allPipes = [a, b, c];
    mocks.historyEntries = [
      { id: "logical", operationId: "logical", type: "third_party_transaction", pipeId: "c", targetPipeId: "b", occurredAt: 3, createdAt: 3, title: "lunch", value: -100 },
      { id: "payment", operationId: "logical", type: "transaction", pipeId: "b", targetPipeId: "c", occurredAt: 3, createdAt: 3, title: "lunch", value: 100 },
      { id: "a-one", operationId: "a-one", type: "transaction", pipeId: "a", occurredAt: 2, createdAt: 2, title: "lunch", value: -100 },
      { id: "a-two", operationId: "a-two", type: "transaction", pipeId: "a", occurredAt: 1, createdAt: 1, title: "lunch", value: -100 },
    ];
    render(<PipesScreen />);
    expect(screen.getByTestId("feed-order").textContent).toBe("a,b,c");
  });

  it("navigates to the parent, falls through at root, and scopes its listener to focus", () => {
    mocks.selectedPipePath = ["root", "child"];
    const { rerender } = render(<PipesScreen />);
    expect(mocks.addEventListener).not.toHaveBeenCalled();

    const removeNestedListener = mocks.focusEffect?.();
    const nestedBackHandler = mocks.addEventListener.mock.calls[0][1];

    expect(nestedBackHandler()).toBe(true);
    expect(mocks.selectPipe).toHaveBeenCalledWith(["root"]);
    removeNestedListener?.();
    expect(mocks.remove).toHaveBeenCalledOnce();

    mocks.selectedPipePath = [];
    rerender(<PipesScreen />);
    const removeRootListener = mocks.focusEffect?.();
    const rootBackHandler = mocks.addEventListener.mock.calls[1][1];
    expect(rootBackHandler()).toBe(false);

    removeRootListener?.();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  it("clears selection when reselecting the focused Pipes tab without blocking tab navigation", () => {
    mocks.selectedPipePath = ["root"];
    mocks.selectedName = "Travel";
    render(<PipesScreen />);
    const cleanup = mocks.focusEffect?.();
    const tabPress = mocks.addTabListener.mock.calls.find(([event]) => event === "tabPress")?.[1];
    expect(tabPress).toBeDefined();

    const preventDefault = vi.fn();
    tabPress({ target: "history-key", preventDefault });
    expect(mocks.deselectPipe).not.toHaveBeenCalled();
    tabPress({ target: "pipes-key", preventDefault });
    expect(mocks.deselectPipe).toHaveBeenCalledOnce();
    expect(preventDefault).not.toHaveBeenCalled();

    cleanup?.();
    expect(mocks.removeTabListener).toHaveBeenCalledOnce();
  });

  it("shows the live report above feeds and opens detail without Latest transactions", async () => {
    const user = userEvent.setup();
    const onOpenCurrentReport = vi.fn();
    mocks.allPipes = [{ id: "leaf", name: "Groceries", icon: "cart" }];
    const { rerender } = render(<PipesScreen onOpenCurrentReport={onOpenCurrentReport} />);
    expect(screen.getByRole("button", { name: "Open June 2026 live spending report" })).toBeDefined();
    expect(screen.getByTestId("offender-pipe-icon").getAttribute("data-icon-name")).toBe("cart");
    mocks.allPipes = [];
    rerender(<PipesScreen onOpenCurrentReport={onOpenCurrentReport} />);
    expect(screen.queryByTestId("offender-pipe-icon")).toBeNull();
    expect(screen.getByTestId("feed-order")).toBeDefined();
    expect(screen.queryByText("Latest transactions")).toBeNull();
    expect(mocks.historyMounts).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Open June 2026 live spending report" }));
    expect(onOpenCurrentReport).toHaveBeenCalledOnce();
  });

  it("shows collapsible recent subtree history after selecting a pipe, but not on the main view", async () => {
    const user = userEvent.setup();
    mocks.allPipes = [
      { id: "root", name: "Travel" },
      { id: "child", name: "Madrid", parentId: "root" },
    ];
    const { rerender } = render(<PipesScreen />);
    expect(screen.queryByText("Latest transactions")).toBeNull();
    expect(screen.queryByTestId("latest-list")).toBeNull();

    mocks.selectedPipePath = ["root"];
    mocks.selectedName = "Travel";
    rerender(<PipesScreen />);
    expect(screen.getByText("Latest transactions")).toBeDefined();
    expect(screen.getByTestId("latest-list").getAttribute("data-pipe-ids")).toBe("root,child");
    expect(screen.getByTestId("latest-list").getAttribute("data-recent")).toBe("true");
    expect(screen.getByTestId("latest-list").getAttribute("data-enabled")).toBe("true");
    await user.click(screen.getByRole("button", { name: "Collapse latest transactions" }));
    expect(screen.getByRole("button", { name: "Expand latest transactions" })).toBeDefined();
    expect(screen.getByTestId("latest-list").parentElement?.style.display).toBe("none");
    expect(screen.getByTestId("latest-list").getAttribute("data-enabled")).toBe("false");
    await user.click(screen.getByRole("button", { name: "Expand latest transactions" }));
    expect(screen.getByRole("button", { name: "Collapse latest transactions" })).toBeDefined();
    expect(screen.getByTestId("latest-list")).toBeDefined();
    expect(screen.getByTestId("latest-list").getAttribute("data-enabled")).toBe("true");
    expect(mocks.historyMounts).toHaveBeenCalledOnce();

    mocks.selectedPipePath = [];
    mocks.selectedName = null;
    rerender(<PipesScreen />);
    expect(screen.queryByText("Latest transactions")).toBeNull();
    expect(screen.queryByTestId("latest-list")).toBeNull();
  });

  it("hides the report card in tree view without resetting the shared report", async () => {
    const user = userEvent.setup();
    render(<PipesScreen />);
    expect(screen.getByRole("button", { name: "Open June 2026 live spending report" })).toBeDefined();
    await user.click(screen.getByTestId("mode-toggle"));
    expect(screen.queryByRole("button", { name: "Open June 2026 live spending report" })).toBeNull();
    await user.click(screen.getByTestId("mode-toggle"));
    expect(screen.getByRole("button", { name: "Open June 2026 live spending report" })).toBeDefined();
  });
});
