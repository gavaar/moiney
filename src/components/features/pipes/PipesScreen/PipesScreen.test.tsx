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

vi.mock("@ui/ScreenHeader/ScreenHeader", () => ({
  ScreenHeader: ({ right }: { right: React.ReactNode }) => <div>{right}</div>,
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
vi.mock("@features/pipes/FeedListScreen", () => ({ FeedListScreen: () => null }));
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
  usePipeCatalog: () => ({ feeds: [], isLoading: false }),
}));

import { PipesScreen } from "./PipesScreen";

describe("Pipes Android back handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.selectedPipePath = [];
    mocks.addEventListener.mockReturnValue({ remove: mocks.remove });
    mocks.useFocusEffect.mockImplementation((effect) => {
      mocks.focusEffect = effect;
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
