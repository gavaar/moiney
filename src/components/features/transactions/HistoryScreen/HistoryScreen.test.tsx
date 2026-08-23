// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadMore: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="history-safe-area">{children}</div>
  ),
}));

vi.mock("@features/app/AppScreenHeader", () => ({
  AppScreenHeader: ({ title }: { title: string }) => (
    <div data-testid="screen-header">{title}</div>
  ),
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  PipeCatalogProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="pipe-catalog-provider">{children}</div>
  ),
}));

vi.mock("@features/transactions/cache/useTransactionHistory", () => ({
  useTransactionHistory: () => ({
    transactions: [],
    isLoading: true,
    isRefreshing: false,
    loadMore: mocks.loadMore,
    loadMoreStatus: "CanLoadMore",
    refresh: mocks.refresh,
  }),
}));

vi.mock("@features/transactions/TransactionListWithHistory", () => ({
  TransactionListWithHistory: ({
    isLoading,
    loadMoreStatus,
    onLoadMore,
    onRefresh,
  }: any) => (
    <div
      data-testid="history-list"
      data-loading={String(isLoading)}
      data-load-more-status={loadMoreStatus}
    >
      <button data-testid="load-more" onClick={onLoadMore} />
      <button data-testid="refresh" onClick={onRefresh} />
    </div>
  ),
}));

import { HistoryScreen } from "./HistoryScreen";

describe("HistoryScreen", () => {
  it("composes the catalog provider, header, and history list", () => {
    render(<HistoryScreen />);

    expect(screen.getByTestId("pipe-catalog-provider")).toBeDefined();
    expect(screen.getByTestId("history-safe-area")).toBeDefined();
    expect(screen.getByTestId("screen-header").textContent).toBe("History");
    expect(screen.getByTestId("history-list").dataset.loading).toBe("true");
    expect(screen.getByTestId("history-list").dataset.loadMoreStatus).toBe(
      "CanLoadMore",
    );
  });

  it("forwards history actions", async () => {
    const user = userEvent.setup();
    render(<HistoryScreen />);

    await user.click(screen.getByTestId("load-more"));
    await user.click(screen.getByTestId("refresh"));

    expect(mocks.loadMore).toHaveBeenCalledOnce();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });
});
