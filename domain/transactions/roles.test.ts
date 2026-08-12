import { describe, expect, it } from "vitest";
import {
  involvedPipeIds,
  transactionRoleNames,
  transactionRoleEntries,
} from "./roles";

describe("transactionRoleNames", () => {
  it("lists every persisted involvement role", () => {
    expect(transactionRoleNames).toEqual(["from", "to", "paidFrom"]);
  });
});

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
