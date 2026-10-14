import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { groupHistoryEvents, type HistoryEntry } from "./event-groups";
import { groupMonthlyEventHistory, type DeletedPipeEntry } from "./event-archives";
import { getFrequentlyUsedEventSourcePipeIds } from "./event-usage";

const expense: HistoryEntry = {
  id: "expense" as Id<"events">,
  operationId: "expense" as Id<"events">,
  pipeId: "source" as Id<"pipes">,
  createdAt: 1,
  occurredAt: 1,
  type: "transaction",
  title: "coffee",
  value: -100,
};

// A newer server's JSON can contain a discriminator absent from this app's types.
const future: HistoryEntry = JSON.parse(JSON.stringify({
  id: "future",
  operationId: "future",
  pipeId: "source",
  createdAt: 2,
  occurredAt: 2,
  type: "future_event",
  details: { message: "New activity" },
}));

describe("unknown history events", () => {
  it("ignores an unknown event instead of turning it into an expense row", () => {
    expect(groupHistoryEvents([future, expense])).toMatchObject([{ kind: "operation", id: "expense", operation: { title: "coffee", value: -100 } },]);
    expect(groupHistoryEvents([future])).toEqual([]);
  });

  it("does not create deleted archives, inflate counts, or rank unknown activity", () => {
    const deleted: DeletedPipeEntry = {
      id: "deleted" as Id<"events">,
      operationId: "deleted" as Id<"events">,
      pipeId: expense.pipeId,
      createdAt: 3,
      occurredAt: 3,
      type: "pipe_deletion",
      name: "Coffee",
      icon: "cafe",
      pipeType: "pipe",
      ancestorIds: [],
    };
    expect(groupMonthlyEventHistory([future], [deleted])).toEqual([]);
    expect(groupMonthlyEventHistory([future, expense], [deleted])).toMatchObject([{ kind: "archive", loadedSummary: { count: 1, spent: 100 }, entries: [expense] },]);
    expect(getFrequentlyUsedEventSourcePipeIds([future])).toEqual([]);
    expect(getFrequentlyUsedEventSourcePipeIds([future, expense])).toEqual([expense.pipeId]);
  });
});
