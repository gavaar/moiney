import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "../../data/transactions";
import { getTransactionDeletionWarning } from "./transactionDeletion.model";

const food = {
  id: "food" as Id<"pipes">,
  name: "Food",
  pendingFedAdjustment: 0,
};
const bank = { id: "bank" as Id<"pipes">, name: "Bank" };
const savings = { id: "savings" as Id<"pipes">, name: "Savings" };
const pipesById = { food, bank, savings } as any;

function transaction(values: Partial<TransactionModel>): TransactionModel {
  return {
    id: "tx" as Id<"transactions">,
    createdAt: 0,
    title: "transaction",
    value: -5000,
    date: 0,
    kind: "expense",
    from: food.id,
    ...values,
  };
}

describe("getTransactionDeletionWarning", () => {
  it.each([
    {
      name: "expenditure",
      transaction: transaction({ value: -5000 }),
      warning: "Deleting this transaction will refund 50.00 of expenditure to Food pipe.",
    },
    {
      name: "refund",
      transaction: transaction({ value: 5000 }),
      warning: "Deleting this transaction will take back a 50.00 refund from Food pipe.",
    },
    {
      name: "feed",
      transaction: transaction({ kind: "feed", from: undefined, to: bank.id, value: 5000 }),
      warning: "Deleting this transaction will take 50.00 of feed from Bank pipe.",
    },
    {
      name: "transfer",
      transaction: transaction({ kind: "transfer", from: bank.id, to: savings.id }),
      warning: "Deleting this transaction will refund 50.00 to Bank pipe and take 50.00 from Savings pipe.",
    },
    {
      name: "pay-by-transfer expenditure",
      transaction: transaction({ paidFrom: bank.id }),
      warning: "Deleting this transaction will roll back 50.00 of expenditure from Food pipe and refund 50.00 to Bank pipe.",
    },
  ])("describes the rollback for a $name", ({ transaction, warning }) => {
    expect(getTransactionDeletionWarning(transaction, pipesById)).toEqual({
      historyOnly: false,
      message: warning,
    });
  });

  it.each([
    { kind: "feed" as const, value: 5000, noun: "feed", from: undefined, to: bank.id },
    { kind: "expense" as const, value: -5000, noun: "expenditure", from: food.id },
    { kind: "expense" as const, value: 5000, noun: "refund", from: food.id },
    { kind: "transfer" as const, value: -5000, noun: "transfer", from: bank.id, to: savings.id },
  ])("uses a history-only warning for a missing $noun pipe", (values) => {
    expect(getTransactionDeletionWarning(transaction(values), {})).toEqual({
      historyOnly: true,
      message: `This transaction belonged to a pipe that does not exist anymore, so deleting it will not roll back any ${values.noun}.`,
    });
  });
});
