// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
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
vi.mock("@ui/TransactionList", () => ({
  TransactionList: () => <div data-testid="latest-list" />,
}));
vi.mock("@ui/Icon", () => ({
  Icon: ({ testID }: any) => <span data-testid={testID ?? "icon"} />,
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

import Pipes from "@/app/(main)/(tabs)/pipes";

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
    const { rerender } = render(<Pipes />);
    expect(mocks.addEventListener).not.toHaveBeenCalled();

    const removeNestedListener = mocks.focusEffect?.();
    const nestedBackHandler = mocks.addEventListener.mock.calls[0][1];

    expect(nestedBackHandler()).toBe(true);
    expect(mocks.selectPipe).toHaveBeenCalledWith(["root"]);
    removeNestedListener?.();
    expect(mocks.remove).toHaveBeenCalledOnce();

    mocks.selectedPipePath = [];
    rerender(<Pipes />);
    const removeRootListener = mocks.focusEffect?.();
    const rootBackHandler = mocks.addEventListener.mock.calls[1][1];
    expect(rootBackHandler()).toBe(false);

    removeRootListener?.();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });

  it("collapses and expands the latest transactions section", async () => {
    const user = userEvent.setup();
    render(<Pipes />);

    expect(screen.getByTestId("latest-list")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Collapse latest transactions" }));
    await waitFor(() => expect(screen.queryByTestId("latest-list")).toBeNull());
    await user.click(screen.getByRole("button", { name: "Expand latest transactions" }));
    expect(screen.getByTestId("latest-list")).toBeDefined();
  });

  it("minimizes the latest transactions section in tree view instead of removing it", async () => {
    const user = userEvent.setup();
    render(<Pipes />);

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

  it("styles the latest transactions bar as a tappable surface with a rotating chevron", () => {
    const source = readFileSync(
      "src/app/(main)/(tabs)/pipes/index.tsx",
      "utf8",
    );

    expect(source).toContain("bg-surface");
    expect(source).toContain("px-3");
    expect(source).toContain('name="chevron-up"');
  });
});
