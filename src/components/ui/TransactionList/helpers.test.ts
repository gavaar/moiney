import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { groupTransactions, type TransactionGroup } from "@features/transactions/groupTransactions";
import { buildFlatItems } from "./helpers";

function transaction(
  id: string,
  title: string,
  value: number,
  date: number,
): Doc<"transactions"> {
  return {
    _id: id as Id<"transactions">,
    _creationTime: date,
    title,
    kind: "expense",
    value,
    date,
    from: "food" as Id<"pipes">,
    userId: "user" as Id<"users">,
  };
}

describe("buildFlatItems", () => {
  it("uses canonical group identities for expansion and unique list keys", () => {
    const grouped = groupTransactions([
      transaction("a1", "item1", 23, 100),
      transaction("a2", "item1", 23, 200),
      transaction("b1", "item", 123, 100),
      transaction("b2", "item", 123, 200),
    ]);
    const groups = grouped as TransactionGroup[];

    const flatItems = buildFlatItems(grouped, new Set([groups[0].id]));
    const groupItems = flatItems.filter((item) => item.kind === "group");

    expect(groupItems.map((item) => item.expanded)).toEqual([true, false]);
    expect(new Set(groupItems.map((item) => item.key)).size).toBe(2);
  });
});
