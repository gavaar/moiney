import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "@features/transactions/data/transactions";
import {
  getFrequentlyUsedSourcePipeIds,
  getQuickTransactionPipes,
} from "./helpers";

function pipe(
  id: string,
  overrides: Partial<PipeModel> = {},
): PipeModel {
  return {
    id: id as Id<"pipes">,
    name: id,
    icon: "cash-outline",
    priority: 0,
    capacity: 1000,
    fed: 800,
    spent: 200,
    ...overrides,
  };
}

describe("getQuickTransactionPipes", () => {
  it("returns active leaves in recent source-usage order", () => {
    const parent = pipe("parent");
    const child = pipe("child", { parentId: parent.id });
    const rootLeaf = pipe("root-leaf");
    const unusedLeaf = pipe("unused-leaf", { parentId: parent.id });
    const deletingLeaf = pipe("deleting-leaf", {
      parentId: parent.id,
      deletionJobId: "job-1" as Id<"pipeDeletionJobs">,
    });
    const pipes = [parent, unusedLeaf, child, deletingLeaf, rootLeaf];
    const childrenByParent = new Map([[parent.id, [child, unusedLeaf, deletingLeaf]]]);

    expect(
      getQuickTransactionPipes(pipes, childrenByParent, [
        rootLeaf.id,
        parent.id,
        child.id,
      ]),
    ).toEqual([rootLeaf, child, unusedLeaf]);
  });
});

describe("getFrequentlyUsedSourcePipeIds", () => {
  it("ranks sources from only the first 100 history transactions", () => {
    const transaction = (
      id: string,
      roles: Pick<TransactionModel, "from" | "to" | "paidFrom">,
    ): TransactionModel => ({
      id: id as Id<"transactions">,
      createdAt: 0,
      title: id,
      value: -100,
      date: 0,
      kind: roles.from ? "expense" : "feed",
      ...roles,
    });
    const history = [
      transaction("tx-1", { from: "pipe-1" as Id<"pipes"> }),
      transaction("tx-2", { to: "pipe-feed" as Id<"pipes"> }),
      transaction("tx-3", {
        from: "pipe-2" as Id<"pipes">,
        paidFrom: "pipe-payer" as Id<"pipes">,
      }),
      transaction("tx-4", { from: "pipe-2" as Id<"pipes"> }),
      transaction("tx-5", { from: "pipe-1" as Id<"pipes"> }),
      ...Array.from({ length: 95 }, (_, index) =>
        transaction(`feed-${index}`, { to: "pipe-feed" as Id<"pipes"> }),
      ),
      transaction("tx-101", { from: "pipe-3" as Id<"pipes"> }),
    ];

    expect(getFrequentlyUsedSourcePipeIds(history)).toEqual([
      "pipe-1",
      "pipe-2",
    ]);
  });
});
