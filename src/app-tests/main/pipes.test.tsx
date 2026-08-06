// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  remove: vi.fn(),
  selectPipe: vi.fn(),
  selectedPipePath: [] as string[],
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

vi.mock("@ui/ScreenHeader/ScreenHeader", () => ({ ScreenHeader: () => null }));
vi.mock("@ui/SlideToggle", () => ({ SlideToggle: () => null }));
vi.mock("@features/pipes/InnerPipesScreen", () => ({
  InnerPipesScreen: () => null,
}));
vi.mock("@features/pipes/PipeTreeView", () => ({ PipeTreeView: () => null }));
vi.mock("@features/pipes/FeedListScreen", () => ({ FeedListScreen: () => null }));
vi.mock("@ui/TransactionList", () => ({ TransactionList: () => null }));
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
  });

  it("navigates to the parent, falls through at root, and removes its listener", () => {
    mocks.selectedPipePath = ["root", "child"];
    const { rerender, unmount } = render(<Pipes />);
    const nestedBackHandler = mocks.addEventListener.mock.calls[0][1];

    expect(nestedBackHandler()).toBe(true);
    expect(mocks.selectPipe).toHaveBeenCalledWith(["root"]);

    mocks.selectedPipePath = [];
    rerender(<Pipes />);
    const rootBackHandler = mocks.addEventListener.mock.calls[1][1];
    expect(rootBackHandler()).toBe(false);

    unmount();
    expect(mocks.remove).toHaveBeenCalledTimes(2);
  });
});
