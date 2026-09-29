import { expect, it } from "vitest";
import {
  mergeMonthlySpending,
  mergeTitleSpending,
  monthlyTitleSpending,
  mostRepeatedTransaction,
  monthlyPipeSpending,
  rankMonthlyOffenders,
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
    nextLargestSpendingCents: [800],
    largestSpendingTransactions: [],
  });
});

it("ranks the three largest individual expenses across pages, including ties", () => {
  const first = summarizeMonthlySpending([
    { kind: "expense", value: -900 }, { kind: "expense", value: -300 }, { kind: "expense", value: 500 },
  ]);
  const second = summarizeMonthlySpending([
    { kind: "expense", value: -900 }, { kind: "expense", value: -700 }, { kind: "feed", value: 50_000 },
  ]);
  expect(mergeMonthlySpending(first, second).nextLargestSpendingCents).toEqual([900, 700]);
});

it("keeps expense titles attached to the three largest individual amounts across pages", () => {
  const first = summarizeMonthlySpending([
    { kind: "expense", title: "rent", value: -108_000 },
    { kind: "expense", title: "coffee", value: -20_000 },
    { kind: "expense", title: "refund", value: 1_000 },
  ]);
  const second = summarizeMonthlySpending([
    { kind: "expense", title: "groceries", value: -10_500 },
    { kind: "expense", title: "fuel", value: -5_000 },
  ]);
  expect(mergeMonthlySpending(first, second).largestSpendingTransactions).toEqual([
    { title: "rent", amountCents: 108_000 },
    { title: "coffee", amountCents: 20_000 },
    { title: "groceries", amountCents: 10_500 },
  ]);
});

it("selects the most repeated expense title by count and nets refunds across pages", () => {
  const totals = mergeTitleSpending(
    monthlyTitleSpending([
      { kind: "expense", title: "Coffee", value: -200 },
      { kind: "expense", title: "coffee", value: 50 },
      { kind: "expense", title: "Lunch", value: -500 },
      { kind: "feed", title: "Coffee", value: 1_000 },
    ]),
    monthlyTitleSpending([
      { kind: "expense", title: " coffee ", value: -300 },
      { kind: "expense", title: "Lunch", value: -400 },
      { kind: "transfer", title: "Coffee", value: -1_000 },
    ]),
  );
  expect(mostRepeatedTransaction(totals)).toEqual({ title: "coffee", count: 3, netSpendingCents: 450 });
  expect(mostRepeatedTransaction(monthlyTitleSpending([{ kind: "expense", title: "Once", value: -100 }]))).toBeNull();
});

it("ranks non-root leaves by net logical spending above their expenditure ceiling", () => {
  const pipes = [
    { id: "root", name: "Bank", capacity: 0 },
    { id: "a", parentId: "root", name: "Alpha", capacity: 100, capUpdateValue: 1_000 },
    { id: "b", parentId: "root", name: "Beta", capacity: 0 },
    { id: "c", parentId: "root", name: "Charlie", capacity: 100 },
    { id: "parent", parentId: "root", name: "Parent", capacity: 10 },
    { id: "nested", parentId: "parent", name: "Nested", capacity: 20 },
  ];
  expect(rankMonthlyOffenders(pipes, [
    { pipeId: "a", netSpendingCents: 400 },
    { pipeId: "b", netSpendingCents: 300 },
    { pipeId: "c", netSpendingCents: 400 },
    { pipeId: "root", netSpendingCents: 1_000 },
    { pipeId: "parent", netSpendingCents: 1_000 },
    { pipeId: "nested", netSpendingCents: -20 },
  ])).toEqual([
    { pipeId: "a", name: "Alpha", netSpendingCents: 400, capacityCents: 100, overageCents: 300 },
    { pipeId: "c", name: "Charlie", netSpendingCents: 400, capacityCents: 100, overageCents: 300 },
    { pipeId: "b", name: "Beta", netSpendingCents: 300, capacityCents: 0, overageCents: 300 },
  ]);
});

it("counts refunds against the logical source and excludes non-overspending leaves", () => {
  expect(rankMonthlyOffenders(
    [{ id: "root", name: "Root", capacity: 0 }, { id: "leaf", parentId: "root", name: "Leaf", capacity: 500 }],
    [{ pipeId: "leaf", netSpendingCents: 500 }],
  )).toEqual([]);
});

it("treats a debt pipe's negative capacity as a zero expenditure ceiling", () => {
  expect(rankMonthlyOffenders([
    { id: "root", name: "Root", capacity: 0 },
    { id: "debt", parentId: "root", name: "Debt", capacity: -1_000 },
  ], [{ pipeId: "debt", netSpendingCents: 200 }])).toEqual([
    { pipeId: "debt", name: "Debt", netSpendingCents: 200, capacityCents: 0, overageCents: 200 },
  ]);
  expect(rankMonthlyOffenders([
    { id: "root", name: "Root", capacity: 0 },
    { id: "debt", parentId: "root", name: "Debt", capacity: -1_000 },
  ], [{ pipeId: "debt", netSpendingCents: -50 }])).toEqual([]);
});

it("attributes ordinary and pay-by-transfer expenses once to their logical leaf", () => {
  expect(monthlyPipeSpending([
    { kind: "expense", value: -700, from: "groceries", paidFrom: "wallet" },
    { kind: "expense", value: 200, from: "groceries", paidFrom: "bank" },
    { kind: "transfer", value: -800, from: "wallet" },
    { kind: "feed", value: 1_000 },
  ])).toEqual([{ pipeId: "groceries", netSpendingCents: 500 }]);
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
