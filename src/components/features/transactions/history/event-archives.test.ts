import { describe, expect, it } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import type { HistoryEntry } from "./event-groups";
import { groupMonthlyEventHistory, type DeletedPipeEntry } from "./event-archives";

const pipe = (id: string) => id as Id<"pipes">;
const event = (id: string) => id as Id<"events">;
const june = Date.UTC(2026, 5, 15);
function deleted(id: string, ancestors: string[] = []): DeletedPipeEntry {
  return { id: event(`deleted-${id}`), operationId: event(`deleted-${id}`), pipeId: pipe(id), createdAt: june, occurredAt: june, type: "pipe_deletion", name: `Final ${id}`, icon: "map", pipeType: "pipe", ancestorIds: ancestors.map(pipe) };
}
function expense(id: string, pipeId: string, occurredAt = june, value = -100): Extract<HistoryEntry, { type: "transaction" }> {
  return { id: event(id), operationId: event(id), pipeId: pipe(pipeId), createdAt: occurredAt, occurredAt, title: "lunch", type: "transaction", value };
}

describe("monthly event archives", () => {
  it("groups by deleted pipe and UTC month, keeping title groups inside each archive", () => {
    const rows = groupMonthlyEventHistory([
      expense("a", "child"), expense("b", "child"), expense("c", "other"),
      expense("july", "child", Date.UTC(2026, 6, 1)),
    ], [deleted("child"), deleted("other")]);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ kind: "archive", pipeId: pipe("child"), month: "2026-07", loadedSummary: { count: 1, spent: 100 } });
    const juneArchive = rows.find(row => row.kind === "archive" && row.pipeId === pipe("child") && row.month === "2026-06");
    expect(juneArchive).toMatchObject({ rows: [expect.objectContaining({ kind: "group", count: 2 })], loadedSummary: { count: 2, spent: 200 } });
    expect(new Set(rows.map(row => row.id)).size).toBe(3);
  });

  it("keeps shared history ordinary for a surviving participant and in every deleted participant's archive", () => {
    const source: HistoryEntry = { ...expense("logical", "source"), type: "third_party_transaction", targetPipeId: pipe("payer") };
    const payer: HistoryEntry = { ...expense("payment", "payer", june, 100), operationId: source.operationId, targetPipeId: pipe("source") };
    const oneDeleted = groupMonthlyEventHistory([source, payer], [deleted("source")]);
    expect(oneDeleted.map(row => row.kind).sort()).toEqual(["archive", "operation"]);
    expect(oneDeleted.find(row => row.kind === "archive")).toMatchObject({ loadedSummary: { count: 1, spent: 100 } });
    const bothDeleted = groupMonthlyEventHistory([source, payer], [deleted("source"), deleted("payer")]);
    expect(bothDeleted).toHaveLength(2);
    for (const row of bothDeleted) expect(row).toMatchObject({ kind: "archive", loadedSummary: { count: 1, spent: 100 } });
  });

  it("matches preserved deleted-descendant ancestry without inventing monetary involvement", () => {
    const entries = [expense("child", "child"), expense("other", "other")];
    const catalog = [deleted("child", ["gone-root", "gone-parent"]), deleted("other", ["different"])];
    const rows = groupMonthlyEventHistory(entries, catalog, [pipe("gone-root")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "archive", pipeId: pipe("child"), event: { ancestorIds: [pipe("gone-root"), pipe("gone-parent")] } });
    expect(groupMonthlyEventHistory(entries, catalog, [pipe("gone-parent")])).toHaveLength(1);
    expect(groupMonthlyEventHistory(entries, catalog, [])).toEqual([]);
  });

  it("keeps lifecycle operations inside their own event month without adding financial amounts", () => {
    const snapshot = deleted("child");
    const creation: HistoryEntry = { ...snapshot, id: event("created"), operationId: event("created"), type: "pipe_creation", occurredAt: Date.UTC(2026, 4, 1) };
    const rows = groupMonthlyEventHistory([creation, snapshot], [snapshot]);
    expect(rows).toHaveLength(2);
    for (const row of rows) expect(row).toMatchObject({ kind: "archive", loadedSummary: { count: 0, spent: 0, oldestDate: null, latestDate: null }, rows: [expect.objectContaining({ kind: "lifecycle" })] });
    expect(rows.map(row => row.kind === "archive" ? row.month : "")).toEqual(["2026-06", "2026-05"]);
  });

  it("counts refunds, payer perspectives, feeds, and transfers correctly without using global contributions", () => {
    const entries: HistoryEntry[] = [
      expense("expense", "payer", june, -100), expense("refund", "payer", june, 20),
      { ...expense("external", "payer", june, 60), operationId: event("logical"), targetPipeId: pipe("source") },
      { ...expense("external-refund", "payer", june, -10), operationId: event("logical-refund"), targetPipeId: pipe("source") },
      { ...expense("feed", "payer", june, 500), type: "feed" },
      { ...expense("transfer", "payer", june, -500), type: "transfer", targetPipeId: pipe("other") },
    ];
    const rows = groupMonthlyEventHistory([...entries, entries[0]], [deleted("payer")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ loadedSummary: { count: 6, spent: 130, oldestDate: june, latestDate: june } });
  });

  it("keeps financial history without a recoverable deletion snapshot readable and does not inject catalog entries", () => {
    const rows = groupMonthlyEventHistory([expense("legacy", "missing")], [deleted("unloaded")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "operation", operation: { id: event("legacy") } });
  });

  it("uses stable archive keys when more rows load and filters ordinary rows by their surviving own perspective", () => {
    const snapshot = deleted("source");
    const source: HistoryEntry = { ...expense("transfer", "source"), type: "transfer", targetPipeId: pipe("live") };
    const mirror: HistoryEntry = { ...expense("mirror", "live", june, 100), operationId: source.operationId, type: "transfer", targetPipeId: pipe("source") };
    const first = groupMonthlyEventHistory([source], [snapshot], [pipe("source")]);
    const next = groupMonthlyEventHistory([source, mirror, expense("new", "source")], [snapshot], [pipe("source")]);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe(first[0].id);
    expect(next[0]).toMatchObject({ kind: "archive", loadedSummary: { count: 2, spent: 100 } });
  });

  it("groups only the Latest window and grows the archive only when main History loads more entries", () => {
    const history = Array.from({ length: 40 }, (_, index) => expense(`expense-${index}`, "child", june - index));
    const catalog = [deleted("child")];
    const latestWindow = history.slice(0, 30);
    const latest = groupMonthlyEventHistory(latestWindow, catalog);
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ entries: latestWindow, loadedSummary: { count: 30, spent: 3000 } });
    if (latest[0].kind !== "archive") throw new Error("Expected archive");
    const nested = latest[0].rows[0];
    if (nested.kind !== "group") throw new Error("Expected title group");
    expect(nested.operations.map(operation => operation.id)).toEqual(latestWindow.map(entry => entry.operationId));

    const moreHistory = groupMonthlyEventHistory(history.slice(0, 35), catalog);
    expect(moreHistory[0].id).toBe(latest[0].id);
    expect(moreHistory[0]).toMatchObject({ loadedSummary: { count: 35, spent: 3500 } });
    expect(latest[0].loadedSummary.count).toBe(30);
  });
});
