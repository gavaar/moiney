import { describe, expect, it } from "vitest";
import { groupTransactions } from "./groupTransactions";
import type { Id } from "@convex/_generated/dataModel";
import type { TransactionModel } from "@features/transactions/data/transactions";

function tx(
  overrides: Partial<TransactionModel> & { date: number },
): TransactionModel {
  const { kind = "expense", ...rest } = overrides;
  return {
    id: `tx-${Math.random()}` as Id<"transactions">,
    createdAt: 0,
    title: "coffee",
    value: -5,
    from: "pipe-a" as Id<"pipes">,
    ...rest,
    kind,
  };
}

describe("groupTransactions", () => {
  it("groups same-title expenses with transfers and excludes internal transfer value", () => {
    const expense = tx({
      title: "barcito",
      value: -500,
      from: "party" as Id<"pipes">,
      date: 300,
    });
    const transfer = tx({
      title: "barcito",
      kind: "transfer",
      value: -100,
      from: "pipe-a" as Id<"pipes">,
      to: "party" as Id<"pipes">,
      date: 200,
    });

    const [group] = groupTransactions([expense, transfer], [
      "pipe-a" as Id<"pipes">,
      "party" as Id<"pipes">,
    ]) as any[];

    expect(group).toMatchObject({
      count: 2,
      totalValue: -500,
      isMixed: true,
      visiblePipeIds: ["party", "pipe-a"],
    });
  });

  it.each([
    ["source scope", ["pipe-a"], "pipe-a", -50, ["pipe-a"]],
    ["destination scope", ["party"], "party", -50, ["party"]],
    ["both scopes", ["pipe-a", "party"], "party", -50, ["party", "pipe-a"]],
  ])(
    "does not count transfers in the grouped total for %s",
    (_label, scope, expensePipe, expectedTotal, expectedVisiblePipeIds) => {
      const expense = tx({
        title: "barcito",
        value: -50,
        from: expensePipe as Id<"pipes">,
        date: 300,
      });
      const transfer = tx({
        title: "barcito",
        kind: "transfer",
        value: -100,
        from: "pipe-a" as Id<"pipes">,
        to: "party" as Id<"pipes">,
        date: 200,
      });

      const [group] = groupTransactions(
        [expense, transfer],
        scope.map((id) => id as Id<"pipes">),
      ) as any[];

      expect(group.totalValue).toBe(expectedTotal);
      expect(group.visiblePipeIds).toEqual(expectedVisiblePipeIds);
    },
  );

  it("returns a single transaction unchanged when no others match", () => {
    const t = tx({ title: "coffee", value: -5, date: 100 });
    const result = groupTransactions([t]);
    expect(result).toEqual([t]);
  });

  it("groups two transactions that share title and pipes", () => {
    const t1 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 200 });
    const t2 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 100 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    const group = result[0] as any;
    expect(group.count).toBe(2);
    expect(group.title).toBe("coffee");
    expect(group.totalValue).toBe(-10);
    expect(group.latestValue).toBe(-5);
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
      id: JSON.stringify(["expense", "coffee"]),
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

  it("groups different values under the same title and pipes", () => {
    const t1 = tx({ title: "coffee", value: -5, date: 100 });
    const t2 = tx({ title: "coffee", value: -3, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    const group = result[0] as any;
    expect(group).toMatchObject({
      count: 2,
      totalValue: -8,
      latestValue: -3,
    });
    expect(group.transactions[0]).toBe(t2);
  });

  it("nets matching expenses and refunds and repeats the latest value", () => {
    const expense = tx({
      title: "coffee",
      value: -500,
      date: 200,
      createdAt: 2,
    });
    const refund = tx({
      title: "coffee",
      value: 200,
      date: 200,
      createdAt: 3,
    });

    const [group] = groupTransactions([expense, refund]) as any[];

    expect(group).toMatchObject({
      count: 2,
      totalValue: -300,
      latestValue: 200,
    });
    expect(group.transactions[0]).toBe(refund);
  });

  it("merges same-title expenses across pipes and marks multiple visible pipes", () => {
    const t1 = tx({ title: "coffee", from: "pipe-a" as Id<"pipes">, date: 100 });
    const t2 = tx({ title: "coffee", from: "pipe-b" as Id<"pipes">, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      count: 2,
      visiblePipeIds: ["pipe-a", "pipe-b"],
    });
  });

  it("merges same-title transfers across destinations", () => {
    const t1 = tx({ kind: "transfer", title: "coffee", from: "pipe-a" as Id<"pipes">, to: "pipe-b" as Id<"pipes">, date: 100 });
    const t2 = tx({ kind: "transfer", title: "coffee", from: "pipe-a" as Id<"pipes">, to: "pipe-c" as Id<"pipes">, date: 200 });
    const result = groupTransactions([t1, t2]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      count: 2,
      visiblePipeIds: ["pipe-a", "pipe-b", "pipe-c"],
    });
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

  it("groups all same-title expense transactions across pipes", () => {
    const t1 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 100 });
    const t2 = tx({ title: "coffee", value: -5, from: "pipe-a" as Id<"pipes">, date: 200 });
    const t3 = tx({ title: "coffee", value: -5, from: "pipe-b" as Id<"pipes">, date: 150 });
    const result = groupTransactions([t1, t2, t3]);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      count: 3,
      totalValue: -15,
      visiblePipeIds: ["pipe-a", "pipe-b"],
    });
  });

  it("keeps parent and descendant transactions visible in the parent scope", () => {
    const transactions = [
      tx({
        id: "child-1-expense" as Id<"transactions">,
        date: 500,
        value: 30000,
        from: "child-1" as Id<"pipes">,
      }),
      tx({
        id: "child-2-expense" as Id<"transactions">,
        date: 400,
        value: 5000,
        from: "child-2" as Id<"pipes">,
      }),
      tx({
        id: "parent-transfer" as Id<"transactions">,
        date: 300,
        kind: "transfer",
        value: -1000,
        from: "outside" as Id<"pipes">,
        to: "parent" as Id<"pipes">,
      }),
      tx({
        id: "child-1-transfer" as Id<"transactions">,
        date: 200,
        kind: "transfer",
        value: -2000,
        from: "child-1" as Id<"pipes">,
        to: "outside" as Id<"pipes">,
      }),
    ];

    const result = groupTransactions(transactions, [
      "parent",
      "child-1",
      "child-2",
    ] as Id<"pipes">[]);

    expect(result).toHaveLength(1);
    expect(result.flatMap((item) => "transactions" in item ? item.transactions : item))
      .toEqual(expect.arrayContaining(transactions));
  });

  it("includes pay-by-transfer expenses when the scope contains only paidFrom", () => {
    const transaction = tx({
      id: "paid-from-parent" as Id<"transactions">,
      date: 100,
      value: -5000,
      from: "outside" as Id<"pipes">,
      paidFrom: "parent" as Id<"pipes">,
    });

    expect(
      groupTransactions([transaction], ["parent"] as Id<"pipes">[]),
    ).toEqual([transaction]);
  });
});
