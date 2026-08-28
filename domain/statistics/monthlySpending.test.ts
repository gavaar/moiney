import { expect, it } from "vitest";
import { summarizeMonthlySpending } from "./monthlySpending";

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
    grossSpendingCents: 2_000,
    refundCents: 250,
    spendingTransactionCount: 2,
    refundTransactionCount: 1,
    largestSpendingTransactionCents: 1_200,
  });
});
