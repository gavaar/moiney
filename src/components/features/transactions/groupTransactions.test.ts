import { describe, expect, it } from "vitest";
import { groupTransactions } from "./groupTransactions";
import type { Doc } from "@convex/_generated/dataModel";
import type { Id } from "@convex/_generated/dataModel";

function tx(
  overrides: Partial<Doc<"transactions">> & { date: number },
): Doc<"transactions"> {
  return {
    _id: `tx-${Math.random()}` as any,
    _creationTime: 0,
    title: "coffee",
    value: -5,
    from: "pipe-a" as Id<"pipes">,
    to: undefined,
    userId: "" as Id<"users">,
    ...overrides,
    kind: overrides.kind ?? "expense",
  };
}

describe("groupTransactions", () => {
  it("returns a single transaction unchanged when no others match", () => {
    const t = tx({ title: "coffee", value: -5, date: 100 });
    const result = groupTransactions([t]);
    expect(result).toEqual([t]);
  });

  it("groups two transactions that share title, value, from, and to", () => {
    const t1 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 200 });
    const t2 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 100 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    const group = result[0] as any;
    expect(group.count).toBe(2);
    expect(group.title).toBe("coffee");
    expect(group.value).toBe(-5);
    expect(group.oldestDate).toBe(100);
    expect(group.latestDate).toBe(200);
    expect(group.transactions).toHaveLength(2);
  });

  it("groups expense provenance together under one canonical identity", () => {
    const t1 = tx({
      date: 200,
      paidFrom: "salary" as Id<"pipes">,
    });
    const t2 = tx({
      date: 100,
      paidFrom: "savings" as Id<"pipes">,
    });

    const [group] = groupTransactions([t1, t2]) as any[];

    expect(group).toMatchObject({
      count: 2,
      kind: "expense",
      id: JSON.stringify(["expense", "coffee", -5, "pipe-a", null]),
    });
  });

  it("returns separate groups for different titles", () => {
    const t1 = tx({ title: "coffee", date: 100 });
    const t2 = tx({ title: "bagel", date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(t2); // sorted by date desc (latest first)
    expect(result[1]).toBe(t1);
  });

  it("returns separate groups for different values", () => {
    const t1 = tx({ title: "coffee", value: -5, date: 100 });
    const t2 = tx({ title: "coffee", value: -3, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(2);
  });

  it("returns separate groups for different from pipes", () => {
    const t1 = tx({ title: "coffee", from: "pipe-a" as Id<"pipes">, date: 100 });
    const t2 = tx({ title: "coffee", from: "pipe-b" as Id<"pipes">, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(2);
  });

  it("returns separate groups for different to pipes", () => {
    const t1 = tx({ kind: "transfer", title: "coffee", from: "pipe-a" as Id<"pipes">, to: "pipe-b" as Id<"pipes">, date: 100 });
    const t2 = tx({ kind: "transfer", title: "coffee", from: "pipe-a" as Id<"pipes">, to: "pipe-c" as Id<"pipes">, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(2);
  });

  it("does not group a single transaction with count < 2", () => {
    const t = tx({ date: 100 });
    const result = groupTransactions([t]);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(t);
  });

  it("sorts groups and singles together by date descending", () => {
    const t1 = tx({ title: "coffee", value: -5, date: 300 });
    const t2 = tx({ title: "coffee", value: -5, date: 100 }); // group with t1
    const t3 = tx({ title: "bagel", date: 200 }); // singleton between them
    const result = groupTransactions([t1, t2, t3]);
    expect(result).toHaveLength(2);
    const group = result[0] as any;
    expect(result[0]).toHaveProperty("count", 2); // group (latest=300) first
    expect(result[1]).toBe(t3); // singleton (200) second
  });

  it("groups the correct transactions by composite key", () => {
    const t1 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 100 });
    const t2 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 200 });
    const t3 = tx({ title: "coffee", value: -5, from: "pipe-b" as Id<"pipes">, date: 150 });
    const result = groupTransactions([t1, t2, t3]);
    expect(result).toHaveLength(2);
    const g1 = result.find((r): r is any => typeof r === "object" && "count" in r)!;
    expect(g1.count).toBe(2);
    expect(g1.from).toBe("pipe-a");
    const singles = result.filter((r) => !("count" in r));
    expect(singles).toHaveLength(1);
    expect(singles[0]).toBe(t3);
  });
});
