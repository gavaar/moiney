import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { normalizeTransaction } from "./transactions";

describe("normalizeTransaction", () => {
  it("maps persisted fields to the frontend model without backend ownership data", () => {
    const persisted: Doc<"transactions"> = {
      _id: "transaction-1" as Id<"transactions">,
      _creationTime: 123,
      title: "coffee",
      value: -500,
      date: 456,
      kind: "expense",
      from: "pipe-1" as Id<"pipes">,
      to: undefined,
      paidFrom: "pipe-2" as Id<"pipes">,
      fromIcon: "archive-box",
      toIcon: undefined,
      paidFromIcon: "wallet",
      editedAt: 789,
      userId: "user-1" as Id<"users">,
    };

    expect(normalizeTransaction(persisted)).toEqual({
      id: "transaction-1",
      createdAt: 123,
      title: "coffee",
      value: -500,
      date: 456,
      kind: "expense",
      from: "pipe-1",
      paidFrom: "pipe-2",
      fromIcon: "archive-box",
      paidFromIcon: "wallet",
      editedAt: 789,
    });
  });
});
