import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "../history/event-groups";
import { EventHistoryStore, type EventHistoryStorage } from "./EventHistoryStore";

const expense: HistoryEntry = {
  id: "expense" as Id<"events">, operationId: "expense" as Id<"events">,
  pipeId: "source" as Id<"pipes">, createdAt: 1, occurredAt: 1,
  type: "transaction", title: "coffee", value: -100,
};
const future: HistoryEntry = JSON.parse(JSON.stringify({
  id: "future", operationId: "future", pipeId: "source", createdAt: 2, occurredAt: 2,
  type: "future_event", details: { message: "New activity" },
}));

function storage() {
  const values = new Map<string, string>();
  const disk: EventHistoryStorage = {
    read: async key => values.get(key) ?? null,
    write: async (key, value) => { values.set(key, value); },
    remove: async key => { values.delete(key); },
  };
  return { values, disk };
}

describe("unknown events in device history", () => {
  it("does not retain unknown server entries in memory or device storage", async () => {
    const { disk } = storage();
    const store = new EventHistoryStore("alice", disk);
    await store.mergeHead([future, expense], true, 1);
    expect(store.read()).toMatchObject({ entries: [expense], complete: true, hasMore: true });
    const next = new EventHistoryStore("alice", disk);
    await next.hydrate();
    expect(next.read()).toMatchObject({ entries: [expense], complete: true, hasMore: true });
  });

  it("hydrates recognized entries from a newer snapshot without invalidating its membership", async () => {
    const { disk, values } = storage();
    values.set("event-history:alice", JSON.stringify({
      version: 1, accountKey: "alice", complete: true, hasMore: true, updatedAt: 1,
      entries: [expense, future].map(entry => ({ entry, refreshedAt: 1 })),
    }));
    const store = new EventHistoryStore("alice", disk);
    await store.hydrate();
    expect(store.read()).toMatchObject({ entries: [expense], complete: true, hasMore: true, updatedAt: 1 });
  });
});
