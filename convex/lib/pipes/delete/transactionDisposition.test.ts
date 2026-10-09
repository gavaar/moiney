import { describe, expect, it } from "vitest";
import {
  planTransactionDisposition,
  type DeletionPipeState,
} from "./transactionDisposition";

const surviving = (): DeletionPipeState => ({
  status: "survives",
});

const deleting = (): DeletionPipeState => ({
  status: "deleting",
});

describe("planTransactionDisposition", () => {
  it.each([
    {
      name: "deletes a feed whose destination is gone",
      transaction: { kind: "feed" as const, to: "deleted" },
      pipes: {},
      deleteTransactions: true,
      expected: { delete: true },
    },
    {
      name: "deletes an ordinary expense whose source is deleting",
      transaction: { kind: "expense" as const, from: "deleted" },
      pipes: { deleted: deleting() },
      deleteTransactions: true,
      expected: { delete: true },
    },
    {
      name: "preserves a pay-by-transfer expense when its category survives",
      transaction: { kind: "expense" as const, from: "category", paidFrom: "deleted" },
      pipes: { category: surviving(), deleted: deleting() },
      deleteTransactions: true,
      expected: { delete: false },
    },
    {
      name: "deletes a pay-by-transfer expense when both roles are gone",
      transaction: { kind: "expense" as const, from: "category", paidFrom: "deleted" },
      pipes: { category: deleting(), deleted: deleting() },
      deleteTransactions: true,
      expected: { delete: true },
    },
    {
      name: "preserves a transfer when its destination survives",
      transaction: { kind: "transfer" as const, from: "deleted", to: "destination" },
      pipes: { deleted: deleting(), destination: surviving() },
      deleteTransactions: true,
      expected: { delete: false },
    },
  ])("$name", ({ transaction, pipes, deleteTransactions, expected }) => {
    expect(
      planTransactionDisposition(transaction, pipes, deleteTransactions),
    ).toEqual(expected);
  });

  it("retains history when requested even if every role is gone", () => {
    expect(
      planTransactionDisposition(
        { kind: "transfer", from: "source", to: "destination" },
        { source: deleting(), destination: {} },
        false,
      ),
    ).toEqual({
      delete: false,
    });
  });
});
