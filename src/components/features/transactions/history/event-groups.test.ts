import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { groupHistoryEvents, type HistoryEntry } from "./event-groups";

const pipe = (id: string) => id as Id<"pipes">;
const eventId = (id: string) => id as Id<"events">;
const june = Date.UTC(2026, 5, 15);

function expense(id: string, overrides: Partial<Extract<HistoryEntry, { type: "transaction" }>> = {}): HistoryEntry {
  return { id: eventId(id), operationId: eventId(id), createdAt: june, occurredAt: june, pipeId: pipe("source"), type: "transaction", title: "lunch", value: -100, ...overrides };
}

function transfer(id: string, value = -100, date = june, target = "target"): HistoryEntry[] {
  return [
    { id: eventId(id), operationId: eventId(id), createdAt: date, occurredAt: date, pipeId: pipe("source"), type: "transfer", targetPipeId: pipe(target), title: "lunch", value },
    { id: eventId(`${id}-mirror`), operationId: eventId(id), createdAt: date + 1, occurredAt: date, pipeId: pipe(target), type: "transfer", targetPipeId: pipe("source"), title: "lunch", value: -value },
  ];
}

function external(id: string, value = -100, payer = "payer"): HistoryEntry[] {
  return [
    { id: eventId(id), operationId: eventId(id), createdAt: june, occurredAt: june, pipeId: pipe("source"), type: "third_party_transaction", targetPipeId: pipe(payer), title: "lunch", value },
    { id: eventId(`${id}-mirror`), operationId: eventId(id), createdAt: june + 1, occurredAt: june, pipeId: pipe(payer), type: "transaction", targetPipeId: pipe("source"), title: "lunch", value: -value },
  ];
}

describe("event operation and title grouping", () => {
  it.each([-100, 100])("collapses transfers by exact operation identity at %s cents, not matching fields", value => {
    const rows = groupHistoryEvents([...transfer("one", value), ...transfer("two", value)]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: 0 });
    if (rows[0].kind !== "group") throw new Error("Expected title group");
    expect(rows[0].operations.map(operation => operation.id).sort()).toEqual([eventId("one"), eventId("two")]);
    for (const operation of rows[0].operations) expect(operation).toMatchObject({ type: "transfer", pipeId: pipe("source"), targetPipeId: pipe("target"), value, entries: expect.any(Array) });
    expect(rows[0].operations.map(operation => operation.entries.length)).toEqual([2, 2]);
  });

  it.each([-100, 100])("projects a transfer mirror-only page without changing structural source at %s cents", value => {
    const entries = transfer("one", value);
    const partial = groupHistoryEvents([entries[1]], [pipe("target")]);
    expect(partial[0]).toMatchObject({ kind: "operation", operation: { id: eventId("one"), type: "transfer", pipeId: pipe("source"), targetPipeId: pipe("target"), value } });
    const complete = groupHistoryEvents(entries, [pipe("target")]);
    expect(complete[0]).toMatchObject({ kind: "operation", operation: { id: eventId("one"), value, entries } });
    expect(partial[0].id).toBe(complete[0].id);
  });

  it.each([-100, 100])("groups payer-only expense/refund perspectives once with logical sign (%s cents)", value => {
    const entries = [...external("one", value), ...external("two", value)];
    const all = groupHistoryEvents(entries);
    const payerOnly = groupHistoryEvents(entries.filter(event => event.pipeId === pipe("payer")), [pipe("payer")]);
    for (const rows of [all, payerOnly]) {
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: value * 2 });
      if (rows[0].kind !== "group") throw new Error("Expected title group");
      for (const operation of rows[0].operations) expect(operation).toMatchObject({ type: "third_party_transaction", pipeId: pipe("source"), targetPipeId: pipe("payer"), value });
    }
    expect(payerOnly[0]).toMatchObject({ visiblePipeIds: [pipe("payer")] });
  });

  it("combines ordinary, externally paid, and transfer operations by title within a UTC month", () => {
    const rows = groupHistoryEvents([expense("ordinary"), ...external("external"), ...transfer("transfer")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", title: "lunch", count: 3, totalValue: -200, visiblePipeIds: [pipe("payer"), pipe("source"), pipe("target")] });
  });

  it.each([
    { scope: ["source"], expensePipe: "source" },
    { scope: ["target"], expensePipe: "target" },
    { scope: ["source", "target"], expensePipe: "target" },
  ])("excludes transfer value from scoped title totals for $scope", ({ scope, expensePipe }) => {
    const rows = groupHistoryEvents([
      expense("expense", { pipeId: pipe(expensePipe), value: -500 }),
      ...transfer("transfer", -300),
    ], scope.map(pipe));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: -500, visiblePipeIds: scope.map(pipe) });
  });

  it("nets expenses and refunds with different values, keeping the newest member first", () => {
    const rows = groupHistoryEvents([
      expense("expense", { value: -500, createdAt: june }),
      expense("refund", { value: 200, createdAt: june + 1 }),
    ]);
    expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: -300, oldestDate: june, latestDate: june });
    if (rows[0].kind !== "group") throw new Error("Expected title group");
    expect(rows[0].operations.map(operation => [operation.id, operation.value])).toEqual([[eventId("refund"), 200], [eventId("expense"), -500]]);
  });

  it("groups expenses across logical sources and payer provenance", () => {
    const rows = groupHistoryEvents([
      expense("ordinary", { pipeId: pipe("other") }),
      ...external("first"),
      ...external("second", -100, "other-payer"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "group", count: 3, totalValue: -300, visiblePipeIds: [pipe("other"), pipe("other-payer"), pipe("payer"), pipe("source")] });
  });

  it("groups transfers across destinations without counting either perspective twice", () => {
    const rows = groupHistoryEvents([
      ...transfer("first"),
      ...transfer("second", -100, june, "other"),
    ]);
    expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: 0, visiblePipeIds: [pipe("other"), pipe("source"), pipe("target")] });
  });

  it("keeps parent and descendant operations visible within an expanded subtree scope", () => {
    const rows = groupHistoryEvents([
      expense("parent", { pipeId: pipe("parent") }),
      expense("child", { pipeId: pipe("child") }),
      expense("grandchild", { pipeId: pipe("grandchild") }),
      expense("outside", { pipeId: pipe("outside") }),
    ], [pipe("parent"), pipe("child"), pipe("grandchild")]);
    expect(rows[0]).toMatchObject({ kind: "group", count: 3, totalValue: -300, visiblePipeIds: [pipe("child"), pipe("grandchild"), pipe("parent")] });
  });

  it("keeps different titles distinct even when their title/value concatenations match", () => {
    const rows = groupHistoryEvents([
      expense("first-a", { title: "item1", value: 23 }),
      expense("first-b", { title: "item1", value: 23 }),
      expense("second-a", { title: "item", value: 123 }),
      expense("second-b", { title: "item", value: 123 }),
    ]);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map(row => row.id)).size).toBe(2);
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "group", title: "item1", count: 2, totalValue: 46 }),
      expect.objectContaining({ kind: "group", title: "item", count: 2, totalValue: 246 }),
    ]));
  });

  it("keeps feed identity separate from spending titles and other destinations", () => {
    const feed = (id: string, destination = "source"): HistoryEntry => ({ id: eventId(id), operationId: eventId(id), createdAt: june, occurredAt: june, pipeId: pipe(destination), type: "feed", title: "lunch", value: 100 });
    const rows = groupHistoryEvents([feed("a"), feed("b"), feed("c", "other"), expense("expense")]);
    expect(rows).toHaveLength(3);
    expect(rows.find(row => row.kind === "group")).toMatchObject({ count: 2, totalValue: 200 });
  });

  it("never merges titles across UTC months", () => {
    const boundary = Date.UTC(2026, 6, 1);
    expect(groupHistoryEvents([
      expense("june", { occurredAt: boundary - 1 }),
      expense("july", { occurredAt: boundary }),
    ])).toHaveLength(2);
  });

  it("keeps adjacent years and the same calendar month in different years separate", () => {
    const january = Date.UTC(2026, 0, 1);
    const rows = groupHistoryEvents([
      expense("january", { occurredAt: january, value: -100 }),
      expense("other-january", { occurredAt: january + 1, value: -300 }),
      expense("december", { occurredAt: january - 1 }),
      expense("prior-january", { occurredAt: Date.UTC(2025, 0, 1) }),
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: "group", count: 2, totalValue: -400, oldestDate: january, latestDate: january + 1 });
    expect(rows.slice(1).map(row => row.id)).toEqual([eventId("december"), eventId("prior-january")]);
  });

  it("filters by participating pipes and excludes non-visible operations without changing group membership", () => {
    const rows = groupHistoryEvents([expense("expense"), ...external("external"), ...transfer("transfer")], [pipe("payer")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "operation", operation: { id: eventId("external") } });
    expect(groupHistoryEvents([expense("expense")], [])).toEqual([]);
  });

  it("retains latest duplicate snapshots rather than counting a repeated page twice", () => {
    const old = expense("expense");
    const current = expense("expense", { title: "edited", value: -200, occurredAt: june + 100 });
    const rows = groupHistoryEvents([old, current, current]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "operation", operation: { id: current.id, title: "edited", value: -200, entries: [current] } });
  });

  it("keeps lifecycle operations separate, with retained ancestry and original snapshots", () => {
    const lifecycle = (id: string, type: "pipe_creation" | "pipe_deletion"): HistoryEntry => ({ id: eventId(id), operationId: eventId(id), createdAt: june, occurredAt: june, pipeId: pipe("child"), type, name: "lunch", icon: "map", pipeType: "pipe", ancestorIds: [pipe("source")] });
    const created = lifecycle("created", "pipe_creation");
    const deleted = lifecycle("deleted", "pipe_deletion");
    const rows = groupHistoryEvents([created, deleted, expense("expense")]);
    expect(rows).toHaveLength(3);
    expect(rows.filter(row => row.kind === "lifecycle")).toEqual(expect.arrayContaining([
      { kind: "lifecycle", id: created.operationId, event: created },
      { kind: "lifecycle", id: deleted.operationId, event: deleted },
    ]));
    // Archive ancestry matching is the next step, not financial operation scope expansion.
    expect(groupHistoryEvents([created, deleted], [pipe("child")])).toHaveLength(2);
  });

  it("orders groups and individuals deterministically by occurrence and creation time, without mutating input", () => {
    const entries = [expense("older", { title: "older", occurredAt: june - 1 }), expense("a", { title: "a", createdAt: june }), expense("b", { title: "b", createdAt: june + 1 })];
    const inputOrder = [...entries];
    const rows = groupHistoryEvents(entries);
    expect(rows.map(row => row.id)).toEqual([eventId("b"), eventId("a"), eventId("older")]);
    expect(entries).toEqual(inputOrder);
  });

  it("orders an actual title group beside operations and lifecycle rows, including exact timestamp ties", () => {
    const lifecycle: HistoryEntry = { id: eventId("lifecycle"), operationId: eventId("lifecycle"), createdAt: june + 5, occurredAt: june, pipeId: pipe("source"), type: "pipe_creation", name: "Source", icon: "wallet", pipeType: "feed", ancestorIds: [] };
    const rows = groupHistoryEvents([
      expense("group-old", { occurredAt: june - 1 }),
      expense("group-new", { createdAt: june + 4 }),
      expense("newest", { title: "newest", occurredAt: june + 1 }),
      expense("a", { title: "a", createdAt: june + 3 }),
      expense("z", { title: "z", createdAt: june + 3 }),
      lifecycle,
    ]);
    expect(rows.map(row => row.kind)).toEqual(["operation", "lifecycle", "group", "operation", "operation"]);
    expect(rows[0].id).toBe(eventId("newest"));
    expect(rows[1].id).toBe(eventId("lifecycle"));
    expect(rows[2]).toMatchObject({ count: 2, latestDate: june, oldestDate: june - 1, createdAt: june + 4 });
    expect(rows.slice(3).map(row => row.id)).toEqual([eventId("z"), eventId("a")]);
  });
});
