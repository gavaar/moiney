import { describe, expect, it } from "vitest";
import {
  deriveTransactionKind,
  resolveTransactionKind,
  transactionGroupId,
} from "./identity";

describe("deriveTransactionKind", () => {
  it.each([
    [{ to: "income" }, "feed"],
    [{ from: "food" }, "expense"],
    [{ from: "food", paidFrom: "salary" }, "expense"],
    [{ from: "checking", to: "savings" }, "transfer"],
  ] as const)("classifies %o as %s", (roles, expected) => {
    expect(deriveTransactionKind(roles)).toBe(expected);
  });

  it.each([
    {},
    { paidFrom: "salary" },
    { to: "income", paidFrom: "salary" },
    { from: "food", to: "income", paidFrom: "salary" },
  ])("rejects invalid roles %o", (roles) => {
    expect(() => deriveTransactionKind(roles)).toThrow(
      "Invalid transaction roles",
    );
  });
});

describe("resolveTransactionKind", () => {
  it("rejects a transaction without a persisted kind", () => {
    expect(() => resolveTransactionKind({ from: "food" })).toThrow(
      "Transaction kind is required",
    );
  });

  it("rejects a persisted kind that disagrees with its roles", () => {
    expect(() =>
      resolveTransactionKind({ kind: "feed", from: "food" }),
    ).toThrow("Transaction kind does not match roles");
  });
});

describe("transactionGroupId", () => {
  it("distinguishes titles without relying on concatenated fields", () => {
    const first = transactionGroupId({
      kind: "expense",
      title: "item1",
      value: 23,
      from: "food",
    });
    const second = transactionGroupId({
      kind: "expense",
      title: "item",
      value: 123,
      from: "food",
    });

    expect(first).not.toBe(second);
  });

  it("groups expenses independently of paidFrom provenance", () => {
    const first = transactionGroupId({
      kind: "expense",
      title: "coffee",
      value: -5,
      from: "food",
      paidFrom: "salary",
    });
    const second = transactionGroupId({
      kind: "expense",
      title: "coffee",
      value: -5,
      from: "food",
      paidFrom: "savings",
    });

    expect(first).toBe(second);
  });
});
