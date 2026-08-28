// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useQuery } from "convex/react";
import { expect, it, vi } from "vitest";
import { MonthlyStatisticsDetail } from "./MonthlyStatisticsDetail";

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
  expect(screen.getByText("Total outcome")).toBeDefined();
  expect(screen.getByText("17.50")).toBeDefined();
  expect(screen.getByText("Total income")).toBeDefined();
  expect(screen.getByText("500.00")).toBeDefined();
  expect(screen.getByText("Spending transactions")).toBeDefined();
  expect(screen.getByText("2")).toBeDefined();
  expect(screen.getByText("Refund transactions")).toBeDefined();
  expect(screen.getByText("1")).toBeDefined();
  expect(screen.getByText("Average spending")).toBeDefined();
  expect(screen.getByText("10.00")).toBeDefined();
  expect(screen.getByText("Largest spending transaction")).toBeDefined();
  expect(screen.getByText("12.00")).toBeDefined();
  expect(screen.getByText("Volume")).toBeDefined();
  expect(screen.getByText("220.00")).toBeDefined();
  expect(screen.getByText("Produced")).toBeDefined();
  expect(screen.getByText("190.00")).toBeDefined();

  await user.click(screen.getByRole("button", { name: "Back to statistics" }));
  expect(onBack).toHaveBeenCalledOnce();
});
