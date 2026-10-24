import { expect, it } from "vitest";
import { invalidPreviousTransactionPipeIds } from "./editEligibility";

const pipes = [
  { id: "root" }, { id: "leaf", parentId: "root" },
  { id: "frozen", blocked: true }, { id: "other" },
];

it("distinguishes missing, frozen, non-leaf source and non-root destination roles", () => {
  expect(invalidPreviousTransactionPipeIds({ type: "expense", from: "missing" }, -100, pipes)).toEqual(["missing"]);
  expect(invalidPreviousTransactionPipeIds({ type: "expense", from: "frozen" }, -100, pipes)).toEqual(["frozen"]);
  expect(invalidPreviousTransactionPipeIds({ type: "transfer", from: "root", to: "leaf" }, -100, pipes)).toEqual(["root", "leaf"]);
  expect(invalidPreviousTransactionPipeIds({ type: "transfer", from: "leaf", to: "other" }, -100, pipes)).toEqual([]);
});

it("uses the original polarity to distinguish a payer leaf from a refund root", () => {
  const paidFromLeaf = { type: "payByTransfer" as const, from: "other", paidFrom: "leaf" };
  const paidFromRoot = { ...paidFromLeaf, paidFrom: "root" };
  expect(invalidPreviousTransactionPipeIds(paidFromLeaf, -100, pipes)).toEqual([]);
  expect(invalidPreviousTransactionPipeIds(paidFromLeaf, 100, pipes)).toEqual(["leaf"]);
  expect(invalidPreviousTransactionPipeIds(paidFromRoot, -100, pipes)).toEqual(["root"]);
  expect(invalidPreviousTransactionPipeIds(paidFromRoot, 100, pipes)).toEqual([]);
});
