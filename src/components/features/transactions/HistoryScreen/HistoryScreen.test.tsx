// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  useTransactionHistory: vi.fn(),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@features/app/AppScreenHeader", () => ({
  AppScreenHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock("@features/transactions/TransactionListWithHistory", () => ({
  TransactionListWithHistory: () => <div data-testid="history-list" />,
}));
vi.mock("@features/transactions/cache/useTransactionHistory", () => ({
  useTransactionHistory: mocks.useTransactionHistory,
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => {
  const allPipes = [
    { id: "parent", name: "Household", icon: "home" },
    { id: "groceries", name: "Groceries", icon: "cart" },
    { id: "coffee", name: "Coffee", icon: "coffee" },
  ];
  return {
    PipeCatalogProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    usePipeCatalog: () => ({
      allPipes,
      childrenByParent: new Map([["parent", [allPipes[1]]]]),
    }),
  };
});
vi.mock("@ui/Input", () => ({
  Input: (props: any) => {
    if (props.type === "text") {
      return (
        <input
          aria-label={props.label}
          value={props.value}
          onChange={(event) => props.onChangeText(event.target.value)}
        />
      );
    }
    if (props.type === "date") {
      return (
        <button
          aria-label={props.label}
          onClick={() =>
            props.onChange(
              new Date(Date.UTC(2026, props.label === "From date" ? 0 : 1, 1, 12)),
            )
          }
        />
      );
    }
    return (
      <div>
        {props.items.map((item: any) => (
          <button key={item.id} onClick={() => props.onChange([...props.value, item.id])}>
            {item.name}
          </button>
        ))}
      </div>
    );
  },
}));
vi.mock("@ui/Button", () => ({
  Button: ({ title, accessibilityLabel, onPress }: any) => (
    <button aria-label={accessibilityLabel} onClick={onPress}>
      {title}
    </button>
  ),
}));

import { HistoryScreen } from "./HistoryScreen";

describe("HistoryScreen filters", () => {
  beforeEach(() => {
    mocks.useTransactionHistory.mockReset();
    mocks.useTransactionHistory.mockReturnValue({
      transactions: [],
      error: null,
      isLoading: false,
      isRefreshing: false,
      loadMore: vi.fn(),
      loadMoreStatus: "Exhausted",
      refresh: vi.fn(),
    });
  });

  it("applies draft filters using only selectable leaf pipes and clears them", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen />);

    expect(screen.queryByRole("button", { name: "Household" })).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Title contains" }), " Coffee ");
    await user.click(screen.getByRole("button", { name: "From date" }));
    await user.click(screen.getByRole("button", { name: "To date" }));
    await user.click(screen.getByRole("button", { name: "Groceries" }));

    expect(mocks.useTransactionHistory.mock.calls.at(-1)?.[0]).toEqual({});
    await user.click(screen.getByRole("button", { name: "Apply filters" }));
    expect(mocks.useTransactionHistory.mock.calls.at(-1)?.[0]).toEqual({
      fromDate: Date.UTC(2026, 0, 1, 12),
      toDate: Date.UTC(2026, 1, 1, 12),
      pipeIds: ["groceries"],
      title: "coffee",
    });

    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(mocks.useTransactionHistory.mock.calls.at(-1)?.[0]).toEqual({});
  });
});
