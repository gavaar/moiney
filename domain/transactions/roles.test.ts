import { describe, expect, it } from "vitest";
import {
  involvedPipeIds,
  transactionRoleEntries,
} from "./roles";

describe("involvedPipeIds", () => {
  it("includes from, to, and paidFrom roles", () => {
    expect(
      involvedPipeIds({ from: "category", to: "destination", paidFrom: "payer" }),
    ).toEqual(["category", "destination", "payer"]);
  });
});

describe("transactionRoleEntries", () => {
  it("uses only the destination role for a feed", () => {
    expect(
      transactionRoleEntries({ kind: "feed", to: "income" }),
    ).toEqual([{ role: "to", pipeId: "income" }]);
  });

  it("uses both category and payer roles for a pay-by-transfer expense", () => {
    expect(
      transactionRoleEntries({
        kind: "expense",
        from: "category",
        paidFrom: "payer",
      }),
    ).toEqual([
      { role: "from", pipeId: "category" },
      { role: "paidFrom", pipeId: "payer" },
    ]);
  });
});
