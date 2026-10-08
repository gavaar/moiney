// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { MonthlyStatisticsCard } from "./MonthlyStatisticsCard";
import type { MonthlySpendingStat } from "./data/monthlySpending";

const report: MonthlySpendingStat = {
  periodStart: Date.UTC(2026, 5, 1), grossSpendingCents: 2000, refundCents: 250,
  spendingTransactionCount: 2, refundTransactionCount: 1, largestSpendingTransactionCents: 1200,
};

it.each([
  [5000, "32.50"],
  [1000, "-7.50"],
  [1750, "0.00"],
  [0, "-17.50"],
  [undefined, "Unavailable"],
] as const)("shows net change for income %s without treating missing income as zero", (totalIncomeCents, expected) => {
  render(<MonthlyStatisticsCard report={{ ...report, totalIncomeCents }} onPress={vi.fn()} />);
  expect(screen.getByText("Net change").parentElement?.textContent).toBe(`Net change${expected}`);
  expect(screen.queryByText("Total outcome")).toBeNull();
  expect(screen.queryByText(/Gross/)).toBeNull();
});

it("shows income, gross outcome, and refunds separately rather than subtracting refunds twice", () => {
  render(<MonthlyStatisticsCard report={{ ...report, totalIncomeCents: 5000 }} onPress={vi.fn()} />);
  expect(screen.getByText((_, element) => element?.textContent === "Income 50.00")).toBeTruthy();
  expect(screen.getByText((_, element) => element?.textContent === "Outcome 20.00")).toBeTruthy();
  expect(screen.getByText((_, element) => element?.textContent === "Refunds: 2.50")).toBeTruthy();
  expect(screen.getByText("32.50")).toBeTruthy();
});

it("retains refunds exceeding gross spending in the net change calculation", () => {
  render(<MonthlyStatisticsCard report={{ ...report, totalIncomeCents: 0, grossSpendingCents: 0 }} onPress={vi.fn()} />);
  expect(screen.getByText("Net change").parentElement?.textContent).toBe("Net change2.50");
});

it("shows unavailable income on a legacy report while retaining known outcome and refunds", () => {
  render(<MonthlyStatisticsCard report={report} onPress={vi.fn()} />);
  expect(screen.getByText((_, element) => element?.textContent === "Income Unavailable")).toBeTruthy();
  expect(screen.getByText((_, element) => element?.textContent === "Outcome 20.00")).toBeTruthy();
  expect(screen.getByText((_, element) => element?.textContent === "Refunds: 2.50")).toBeTruthy();
});
