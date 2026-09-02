import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { orderFeedsByTreeUsage } from "./feedOrdering";

function pipe(
  id: string,
  parentId?: Id<"pipes">,
): PipeModel {
  return {
    id: id as Id<"pipes">,
    ...(parentId ? { parentId } : {}),
    name: id,
    icon: "cash-outline",
    priority: 0,
    capacity: 1000,
    fed: 1000,
    spent: 0,
  };
}

function transaction(
  id: string,
  roles: Pick<TransactionModel, "from" | "to" | "paidFrom">,
): TransactionModel {
  return {
    id: id as Id<"transactions">,
    createdAt: 0,
    title: id,
    value: -100,
    date: 0,
    kind: roles.from && roles.to ? "transfer" : roles.from ? "expense" : "feed",
    ...roles,
  };
}

describe("orderFeedsByTreeUsage", () => {
  it("ranks feeds by transactions involving any role in their tree", () => {
    const feedA = pipe("feed-a");
    const feedB = pipe("feed-b");
    const feedC = pipe("feed-c");
    const childA = pipe("child-a", feedA.id);
    const childB = pipe("child-b", feedB.id);
    const childC = pipe("child-c", feedC.id);
    const history = [
      transaction("transfer", { from: childB.id, to: feedA.id }),
      transaction("expense-c", { from: childC.id }),
      transaction("feed-c", { to: feedC.id }),
      transaction("paid-elsewhere", {
        from: childB.id,
        paidFrom: childA.id,
      }),
      transaction("expense-b", { from: childB.id }),
    ];

    expect(
      orderFeedsByTreeUsage(
        [feedC, feedA, feedB],
        [feedA, feedB, feedC, childA, childB, childC],
        history,
      ),
    ).toEqual([feedB, feedA, feedC]);
  });

  it("uses all available cached History rows", () => {
    const feedA = pipe("feed-a");
    const feedB = pipe("feed-b");
    const history = [
      transaction("feed-a", { to: feedA.id }),
      ...Array.from({ length: 99 }, (_, index) =>
        transaction(`unknown-${index}`, {
          to: "missing-pipe" as Id<"pipes">,
        }),
      ),
      transaction("late-b-1", { to: feedB.id }),
      transaction("late-b-2", { to: feedB.id }),
    ];

    expect(
      orderFeedsByTreeUsage([feedB, feedA], [feedA, feedB], history),
    ).toEqual([feedB, feedA]);
  });
});
