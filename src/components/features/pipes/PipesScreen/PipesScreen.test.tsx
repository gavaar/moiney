// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  remove: vi.fn(),
  selectPipe: vi.fn(),
  selectedPipePath: [] as string[],
  useFocusEffect: vi.fn(),
  focusEffect: undefined as undefined | (() => void | (() => void)),
  feeds: [] as any[],
  allPipes: [] as any[],
  historyTransactions: [] as any[],
  historySnapshot: {
    transactions: [] as any[],
    complete: true,
    hasMore: false,
    updatedAt: 1,
  },
  historyOptions: undefined as any,
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
vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => (
    <span data-testid={testID ?? "icon"} data-icon-name={name} />
  ),
}));
vi.mock("@features/transactions/context/TransactionsContext", () => ({
  useTransactions: () => ({ transactions: [], isLoading: false }),
}));
vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({
  useTransactionCache: () => ({
    cache: {},
    read: () => mocks.historySnapshot,
  }),
}));
vi.mock("@features/transactions/cache/useTransactionHistory", () => ({
  useTransactionHistory: (_filters: unknown, options: unknown) => {
    mocks.historyOptions = options;
    return { transactions: mocks.historyTransactions, isLoading: false };
  },
}));
vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    feeds: [],
    isLoading: false,
    selectedName: null,
    selectedPipePath: mocks.selectedPipePath,
    selectPipe: mocks.selectPipe,
    deselectPipe: vi.fn(),
  }),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    feeds: mocks.feeds,
    allPipes: mocks.allPipes,
    isLoading: false,
  }),
}));

import { PipesScreen } from "./PipesScreen";

describe("Pipes Android back handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedPipePath = [];
    mocks.feeds = [];
    mocks.allPipes = [];
    mocks.historyTransactions = [];
    mocks.historySnapshot = {
      transactions: [],
      complete: true,
      hasMore: false,
      updatedAt: 1,
    };
    mocks.historyOptions = undefined;
    mocks.addEventListener.mockReturnValue({ remove: mocks.remove });
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
    mocks.historyTransactions = [
      { id: "tx-1", kind: "expense", from: childB.id },
      { id: "tx-2", kind: "expense", from: childA.id },
      { id: "tx-3", kind: "expense", from: childB.id },
    ];

    render(<PipesScreen />);

    expect(screen.getByTestId("feed-order").textContent).toBe("feed-b,feed-a");
    expect(mocks.historyOptions).toEqual({
      enabled: true,
      minimumCachedRows: 100,
    });
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

  it("collapses and expands the latest transactions section", async () => {
    const user = userEvent.setup();
    render(<PipesScreen />);

    expect(screen.getByTestId("latest-list")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Collapse latest transactions" }));
    await waitFor(() => expect(screen.queryByTestId("latest-list")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Expand latest transactions" }));
    expect(screen.getByTestId("latest-list")).toBeDefined();
  });

  it("minimizes the latest transactions section in tree view instead of removing it", async () => {
    const user = userEvent.setup();
    render(<PipesScreen />);

    expect(screen.getByTestId("latest-list")).toBeDefined();
    expect(
      screen.getByRole("button", { name: "Collapse latest transactions" }),
    ).toBeDefined();

    await user.click(screen.getByTestId("mode-toggle"));
    await waitFor(() => expect(screen.queryByTestId("latest-list")).toBeNull());
    expect(
      screen.getByRole("button", { name: "Expand latest transactions" }),
    ).toBeDefined();

    await user.click(screen.getByTestId("mode-toggle"));
    await waitFor(() => expect(screen.getByTestId("latest-list")).toBeDefined());
  });

  it("renders the latest transactions control with an accessible chevron", () => {
    render(<PipesScreen />);

    expect(screen.getByRole("button", {
      name: "Collapse latest transactions",
    })).toBeDefined();
    expect(screen.getByTestId("icon").getAttribute("data-icon-name")).toBe(
      "chevron-up",
    );
  });
});
