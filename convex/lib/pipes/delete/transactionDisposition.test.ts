import { describe, expect, it } from "vitest";
import {
  planTransactionDisposition,
  type DeletionPipeState,
} from "./transactionDisposition";

const surviving = (icon = "pipe"): DeletionPipeState => ({
  status: "survives",
  icon,
});

const deleting = (icon = "pipe"): DeletionPipeState => ({
  status: "deleting",
  icon,
});

describe("planTransactionDisposition", () => {
  it.each([
    {
      name: "deletes a feed whose destination is gone",
      transaction: { kind: "feed" as const, to: "deleted" },
      pipes: {},
      deleteTransactions: true,
      expected: { delete: true, patches: {} },
    },
    {
      name: "deletes an ordinary expense whose source is deleting",
      transaction: { kind: "expense" as const, from: "deleted" },
      pipes: { deleted: deleting("food") },
      deleteTransactions: true,
      expected: { delete: true, patches: {} },
    },
    {
      name: "preserves a pay-by-transfer expense when its category survives",
      transaction: { kind: "expense" as const, from: "category", paidFrom: "deleted" },
      pipes: { category: surviving("category-icon"), deleted: deleting("payer-icon") },
      deleteTransactions: true,
      expected: { delete: false, patches: { paidFromIcon: "payer-icon" } },
    },
    {
      name: "deletes a pay-by-transfer expense when both roles are gone",
      transaction: { kind: "expense" as const, from: "category", paidFrom: "deleted" },
      pipes: { category: deleting("category-icon"), deleted: deleting("payer-icon") },
      deleteTransactions: true,
      expected: { delete: true, patches: {} },
    },
    {
      name: "preserves a transfer when its destination survives",
      transaction: { kind: "transfer" as const, from: "deleted", to: "destination" },
      pipes: { deleted: deleting("source-icon"), destination: surviving("destination-icon") },
      deleteTransactions: true,
      expected: { delete: false, patches: { fromIcon: "source-icon" } },
    },
  ])("$name", ({ transaction, pipes, deleteTransactions, expected }) => {
    expect(
      planTransactionDisposition(transaction, pipes, deleteTransactions),
    ).toEqual(expected);
  });

  it("stores icons for every missing role when history is preserved", () => {
    expect(
      planTransactionDisposition(
        { kind: "transfer", from: "source", to: "destination" },
        { source: deleting("source-icon"), destination: {} },
        false,
      ),
    ).toEqual({
      delete: false,
      patches: { fromIcon: "source-icon" },
    });
  });
});
