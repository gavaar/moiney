import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { HistoryEntry } from "./event-groups";
import { getFrequentlyUsedEventSourcePipeIds, orderFeedsByEventTreeUsage } from "./event-usage";

const id = (value: string) => value as Id<"pipes">;
const eventId = (value: string) => value as Id<"events">;
function pipe(value: string, parentId?: Id<"pipes">): PipeModel {
  return { id: id(value), parentId, name: value, icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
}
function expense(value: string, source: string, date: number): Extract<HistoryEntry, { type: "transaction" }> {
  return { id: eventId(value), operationId: eventId(value), pipeId: id(source), createdAt: date, occurredAt: date, type: "transaction", title: "same", value: -100 };
}
function history(): HistoryEntry[] {
  return [
    { ...expense("external", "a", 10), type: "third_party_transaction", targetPipeId: id("b") },
    { ...expense("payment", "b", 10), operationId: eventId("external"), targetPipeId: id("a"), value: 100 },
    { ...expense("transfer", "a", 9), type: "transfer", targetPipeId: id("b") },
    { ...expense("transfer-mirror", "b", 9), operationId: eventId("transfer"), type: "transfer", targetPipeId: id("a"), value: 100 },
    expense("b-only", "b", 8), expense("c-1", "c", 7), expense("c-2", "c", 6), expense("c-3", "c", 5),
  ];
}

describe("event usage ranking", () => {
  it("ranks logical sources once per operation, ignoring feeds, lifecycle rows, and payment mirrors", () => {
    const entries: HistoryEntry[] = [
      { ...expense("feed", "b", 12), type: "feed", value: 1000 },
      { id: eventId("created"), operationId: eventId("created"), pipeId: id("b"), createdAt: 11, occurredAt: 11, type: "pipe_creation", name: "b", icon: "wallet", pipeType: "feed", ancestorIds: [] },
      ...history(), history()[0],
    ];
    expect(getFrequentlyUsedEventSourcePipeIds(entries)).toEqual([id("c"), id("a"), id("b")]);
  });

  it("resolves logical sources from mirror-only pages without fetching missing members", () => {
    const entries = history();
    const canonicalOnly = entries.filter(event => event.id === event.operationId);
    const mirrorOnly = entries.filter(event => event.id !== event.operationId || event.operationId === eventId("b-only") || event.pipeId === id("c"));
    expect(getFrequentlyUsedEventSourcePipeIds(mirrorOnly)).toEqual([id("c"), id("a"), id("b")]);
    expect(getFrequentlyUsedEventSourcePipeIds(canonicalOnly)).toEqual([id("c"), id("a"), id("b")]);
  });

  it("counts each operation once per involved root, not once per stored perspective", () => {
    const feeds = [pipe("c"), pipe("a"), pipe("b")];
    expect(orderFeedsByEventTreeUsage(feeds, feeds, history()).map(feed => feed.id)).toEqual([id("b"), id("c"), id("a")]);
    const withinTree: HistoryEntry[] = [
      { ...expense("same-tree", "child", 20), type: "transfer", targetPipeId: id("a") },
      { ...expense("same-tree-mirror", "a", 20), type: "transfer", operationId: eventId("same-tree"), targetPipeId: id("child"), value: 100 },
      expense("b-one", "b", 21), expense("b-two", "b", 22),
    ];
    expect(orderFeedsByEventTreeUsage(feeds, [...feeds, pipe("child", id("a"))], withinTree).map(feed => feed.id)).toEqual([id("b"), id("a"), id("c")]);
  });

  it("preserves recent-source ties across title groups and leaves unused feed order unchanged", () => {
    const entries = [expense("older-a", "a", 1), { ...expense("b", "b", 3), title: "other" }, expense("new-a", "a", 4), { ...expense("older-b", "b", 2), title: "other" }];
    expect(getFrequentlyUsedEventSourcePipeIds(entries)).toEqual([id("a"), id("b")]);
    const feeds = [pipe("c"), pipe("b"), pipe("a")];
    expect(orderFeedsByEventTreeUsage(feeds, feeds, [])).toEqual(feeds);
    expect(getFrequentlyUsedEventSourcePipeIds([])).toEqual([]);
  });

  it("includes feeds in tree usage but excludes lifecycle activity and unknown trees", () => {
    const feeds = [pipe("a"), pipe("b")];
    const entries: HistoryEntry[] = [
      { ...expense("feed", "b", 3), type: "feed", value: 1000 },
      expense("unknown", "deleted", 4),
      { id: eventId("deleted-a"), operationId: eventId("deleted-a"), pipeId: id("a"), createdAt: 5, occurredAt: 5, type: "pipe_deletion", name: "a", icon: "wallet", pipeType: "feed", ancestorIds: [] },
    ];
    expect(orderFeedsByEventTreeUsage(feeds, feeds, entries)).toEqual([feeds[1], feeds[0]]);
  });
});
