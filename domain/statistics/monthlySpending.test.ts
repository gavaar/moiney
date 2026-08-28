import { expect, it } from "vitest";
import {
  summarizeMonthlySpending,
  summarizeRootFeedSnapshot,
} from "./monthlySpending";

it("summarizes expenditure without counting feeds or transfers", () => {
  expect(
    summarizeMonthlySpending([
      { kind: "expense", value: -1_200 },
      { kind: "expense", value: -800 },
      { kind: "expense", value: 250 },
      { kind: "feed", value: 50_000 },
      { kind: "transfer", value: -10_000 },
    ]),
  ).toEqual({
    totalIncomeCents: 50_000,
    grossSpendingCents: 2_000,
    refundCents: 250,
    spendingTransactionCount: 2,
    refundTransactionCount: 1,
    largestSpendingTransactionCents: 1_200,
  });
});

it("summarizes root feed and boiler balances without double-counting children", () => {
  expect(
    summarizeRootFeedSnapshot([
      { fed: 10_000, spent: 2_000 },
      { fed: 15_000, spent: 1_000, contributedFed: 12_000 },
      { fed: 500, spent: 1_000 },
      { parentId: "root", fed: 5_000, spent: 500 },
    ]),
  ).toEqual({
    volumeCents: 21_500,
    producedCents: 18_500,
  });
});
