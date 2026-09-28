// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { expect, it, vi } from "vitest";
import { MonthlyStatisticsDetail } from "./MonthlyStatisticsDetail";

const mocks = vi.hoisted(() => ({ allPipes: [] as { id: string; icon: string }[] }));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes: mocks.allPipes }),
}));
vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: { name: string; testID?: string }) => <span data-testid={testID ?? "icon"} data-icon-name={name} />,
  safeIconName: (name: string) => name,
}));

vi.mock("convex/react", () => ({ useQuery: vi.fn() }));

vi.mock("@convex/_generated/api", () => ({
  api: { monthlySpendingStats: { getMine: "getMonthlySpendingStat" } },
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

vi.mock("@ui/ScreenHeader/ScreenHeader", () => ({
  ScreenHeader: ({ title, left }: { title: string; left: React.ReactNode }) => (
    <header>
      {left}
      <h1>{title}</h1>
    </header>
  ),
}));

it("shows the complete monthly report and supports back navigation", async () => {
  const user = userEvent.setup();
  const onBack = vi.fn();
  vi.mocked(useQuery).mockReturnValue({
    periodStart: Date.UTC(2026, 5, 1),
    totalIncomeCents: 50_000,
    grossSpendingCents: 2_000,
    refundCents: 250,
    spendingTransactionCount: 2,
    refundTransactionCount: 1,
    largestSpendingTransactionCents: 1_200,
    volumeCents: 22_000,
    producedCents: 19_000,
  } as any);

  render(
    <MonthlyStatisticsDetail
      periodStart={Date.UTC(2026, 5, 1)}
      onBack={onBack}
    />,
  );

  expect(screen.getByText("June 2026")).toBeDefined();
  expect(screen.getByText("Gross spending")).toBeDefined();
  expect(screen.getByText("20.00")).toBeDefined();
  expect(screen.getByText("Refunds")).toBeDefined();
  expect(screen.getByText("2.50")).toBeDefined();
  expect(screen.getByText("Outcome")).toBeDefined();
  expect(screen.getByText("17.50")).toBeDefined();
  expect(screen.getByText("Income")).toBeDefined();
  expect(screen.getByText("500.00")).toBeDefined();
  expect(screen.getByText("Spending transactions")).toBeDefined();
  expect(screen.getByText("2")).toBeDefined();
  expect(screen.getByText("Refund transactions")).toBeDefined();
  expect(screen.getByText("1")).toBeDefined();
  expect(screen.getByText("Transaction average")).toBeDefined();
  expect(screen.getByText("10.00")).toBeDefined();
  expect(screen.getByText("Largest spending transaction")).toBeDefined();
  expect(screen.getByText("12.00")).toBeDefined();
  expect(screen.getByText("Volume")).toBeDefined();
  expect(screen.getByText("220.00")).toBeDefined();
  expect(screen.getByText("Produced")).toBeDefined();
  expect(screen.getByText("190.00")).toBeDefined();
  const content = screen.getByText("Monthly overview").ownerDocument.body.textContent ?? "";
  const labels = ["Volume", "Produced", "Income", "Outcome", "Gross spending", "Refunds", "Spending transactions", "Refund transactions", "Transaction average", "Most repeated", "Largest spending transaction", "Biggest offenders"];
  for (let index = 1; index < labels.length; index += 1) {
    expect(content.indexOf(labels[index - 1])).toBeLessThan(content.indexOf(labels[index]));
  }

  await user.click(screen.getByRole("button", { name: "Back to statistics" }));
  expect(onBack).toHaveBeenCalledOnce();
});

it("shows only a full-width Volume when produced is the same balance", () => {
  vi.mocked(useQuery).mockReturnValue({
    periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 0, refundCents: 0,
    spendingTransactionCount: 0, refundTransactionCount: 0, largestSpendingTransactionCents: 0,
    volumeCents: 22_000, producedCents: 22_000, mostRepeatedTransaction: null,
  } as any);
  render(<MonthlyStatisticsDetail periodStart={Date.UTC(2026, 5, 1)} onBack={vi.fn()} />);
  expect(screen.getByText("Volume")).toBeDefined();
  expect(screen.queryByText("Produced")).toBeNull();
  expect(screen.getByText("No repeat info yet")).toBeDefined();
});

it("shows frozen ranked offenders and their net spending, ceiling, and overage", () => {
  mocks.allPipes = [{ id: "leaf", icon: "cart" }];
  vi.mocked(useQuery).mockReturnValue({
    periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 800, refundCents: 0,
    spendingTransactionCount: 1, refundTransactionCount: 0, largestSpendingTransactionCents: 800,
    offenders: [
      { pipeId: "leaf", name: "Groceries", netSpendingCents: 800, capacityCents: 500, overageCents: 300 },
      { pipeId: "deleted", name: "Old pipe", netSpendingCents: 400, capacityCents: 200, overageCents: 200 },
    ],
  } as any);
  render(<MonthlyStatisticsDetail periodStart={Date.UTC(2026, 5, 1)} onBack={vi.fn()} />);
  expect(screen.getByText(/Groceries/)).toBeDefined();
  expect(screen.getByText(/Net spent 8.00/)).toBeDefined();
  expect(screen.getByText(/Capacity 5.00/)).toBeDefined();
  expect(screen.getByText(/Over by 3.00/)).toBeDefined();
  expect(screen.getByTestId("offender-pipe-icon-1").getAttribute("data-icon-name")).toBe("cart");
  expect(screen.queryByTestId("offender-pipe-icon-2")).toBeNull();
  expect(screen.getByText("Groceries").parentElement?.textContent).toContain("Groceries#1");
  expect(screen.getByText("Old pipe").parentElement?.textContent).toContain("Old pipe#2");
});

it("shows the three largest expense titles and amounts in vertical order and the repeated transaction", () => {
  vi.mocked(useQuery).mockReturnValue({
    periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 3_000, refundCents: 0,
    spendingTransactionCount: 3, refundTransactionCount: 0,
    largestSpendingTransactionCents: 1_200, nextLargestSpendingCents: [1_000, 800],
    largestSpendingTransactions: [
      { title: "rent", amountCents: 1_200 },
      { title: "lunch", amountCents: 1_000 },
      { title: "coffee", amountCents: 800 },
    ],
    mostRepeatedTransaction: { title: "mercadona", count: 10, netSpendingCents: 16_966 },
  } as any);
  render(<MonthlyStatisticsDetail periodStart={Date.UTC(2026, 5, 1)} onBack={vi.fn()} />);
  const largest = screen.getByText("Largest spending transaction").parentElement!;
  expect(largest.textContent).toContain("rent · 12.00");
  expect(largest.textContent).toContain("lunch · 10.00");
  expect(largest.textContent).toContain("coffee · 8.00");
  expect(largest.textContent!.indexOf("rent")).toBeLessThan(largest.textContent!.indexOf("lunch"));
  expect(largest.textContent!.indexOf("lunch")).toBeLessThan(largest.textContent!.indexOf("coffee"));
  expect(screen.getByText("Most repeated").parentElement?.textContent).toContain("mercadona · 169.66 (10x)");
});

it("preserves amount-only rows for older frozen reports without titles", () => {
  vi.mocked(useQuery).mockReturnValue({
    periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 1_500, refundCents: 0,
    spendingTransactionCount: 2, refundTransactionCount: 0,
    largestSpendingTransactionCents: 1_200, nextLargestSpendingCents: [300],
  } as any);
  render(<MonthlyStatisticsDetail periodStart={Date.UTC(2026, 5, 1)} onBack={vi.fn()} />);
  const largest = screen.getByText("Largest spending transaction").parentElement!;
  expect(largest.textContent).toContain("12.00");
  expect(largest.textContent).toContain("3.00");
  expect(screen.getByText("Most repeated").parentElement?.textContent).toContain("No repeat info yet");
});
