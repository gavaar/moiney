import { describe, expect, it } from "vitest";
import { transactionStructureFromRoles } from "./structure";

describe("transactionStructureFromRoles", () => {
  it.each([
    [{ kind: "feed" as const, to: "income" }, { type: "feed", to: "income" }],
    [{ kind: "expense" as const, from: "food" }, { type: "expense", from: "food" }],
    [
      { kind: "expense" as const, from: "food", paidFrom: "bank" },
      { type: "payByTransfer", from: "food", paidFrom: "bank" },
    ],
    [
      { kind: "transfer" as const, from: "source", to: "destination" },
      { type: "transfer", from: "source", to: "destination" },
    ],
  ])("normalizes valid persisted roles", (roles, expected) => {
    expect(transactionStructureFromRoles(roles)).toEqual(expected);
  });

  it.each([
    { kind: "feed" as const, from: "source", to: "income" },
    { kind: "expense" as const, from: "food", to: "income" },
    { kind: "expense" as const, paidFrom: "bank" },
    { kind: "transfer" as const, from: "source" },
  ])("rejects contradictory or incomplete roles", (roles) => {
    expect(() => transactionStructureFromRoles(roles)).toThrow("Invalid transaction structure");
  });
});
