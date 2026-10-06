import type { Id } from "@convex/_generated/dataModel";
import { groupHistoryEvents, type EventHistoryRow, type HistoryEntry } from "./event-groups";

export type DeletedPipeEntry = Extract<HistoryEntry, { type: "pipe_deletion" }>;
export type EventArchiveSummary = { count: number; spent: number; oldestDate: number | null; latestDate: number | null };
export type MonthlyEventArchive = {
  kind: "archive"; id: string; pipeId: Id<"pipes">; month: string;
  event: DeletedPipeEntry; entries: HistoryEntry[]; rows: EventHistoryRow[];
  loadedSummary: EventArchiveSummary; latestDate: number; createdAt: number;
};

function summarizeRows(rows: EventHistoryRow[]): EventArchiveSummary {
  const summary: EventArchiveSummary = { count: 0, spent: 0, oldestDate: null, latestDate: null };
  for (const row of rows) {
    const operations = row.kind === "group" ? row.operations : row.kind === "operation" ? [row.operation] : [];
    for (const operation of operations) {
      summary.count++;
      if (operation.type === "transaction" || operation.type === "third_party_transaction") summary.spent -= operation.value;
      summary.oldestDate = Math.min(summary.oldestDate ?? operation.occurredAt, operation.occurredAt);
      summary.latestDate = Math.max(summary.latestDate ?? operation.occurredAt, operation.occurredAt);
    }
  }
  return summary;
}

export function groupMonthlyEventHistory(
  entries: readonly HistoryEntry[], deletedPipes: readonly DeletedPipeEntry[], visiblePipeIds?: readonly Id<"pipes">[],
): (EventHistoryRow | MonthlyEventArchive)[] {
  const scope = visiblePipeIds === undefined ? undefined : new Set(visiblePipeIds);
  const deleted = new Map([...entries.filter((entry): entry is DeletedPipeEntry => entry.type === "pipe_deletion"), ...deletedPipes].map(entry => [entry.pipeId, entry]));
  const uniqueEntries = new Map(entries.map(entry => [entry.id, entry]));
  const ordinary: HistoryEntry[] = [];
  const archives = new Map<string, { event: DeletedPipeEntry; month: string; entries: HistoryEntry[] }>();
  for (const entry of uniqueEntries.values()) {
    const snapshot = deleted.get(entry.pipeId);
    if (!snapshot) {
      if (!scope || scope.has(entry.pipeId)) ordinary.push(entry);
      continue;
    }
    if (scope && !scope.has(snapshot.pipeId) && !snapshot.ancestorIds.some(id => scope.has(id))) continue;
    const month = new Date(entry.occurredAt).toISOString().slice(0, 7);
    const key = JSON.stringify(["archive", entry.pipeId, month]);
    const archive = archives.get(key);
    if (archive) archive.entries.push(entry);
    else archives.set(key, { event: snapshot, month, entries: [entry] });
  }

  const rows: (EventHistoryRow | MonthlyEventArchive)[] = groupHistoryEvents(ordinary, visiblePipeIds);
  for (const [id, archive] of archives) {
    const nested = groupHistoryEvents(archive.entries, [archive.event.pipeId]);
    const newest = [...archive.entries].sort((a, b) => b.occurredAt - a.occurredAt || b.createdAt - a.createdAt || b.id.localeCompare(a.id))[0];
    rows.push({
      kind: "archive", id, pipeId: archive.event.pipeId, month: archive.month,
      event: archive.event, entries: archive.entries, rows: nested,
      loadedSummary: summarizeRows(nested), latestDate: newest.occurredAt, createdAt: newest.createdAt,
    });
  }
  const order = (row: EventHistoryRow | MonthlyEventArchive) => {
    if (row.kind === "group" || row.kind === "archive") return { date: row.latestDate, createdAt: row.createdAt };
    const entry = row.kind === "operation" ? row.operation : row.event;
    return { date: entry.occurredAt, createdAt: entry.createdAt };
  };
  return rows.sort((a, b) => order(b).date - order(a).date || order(b).createdAt - order(a).createdAt || b.id.localeCompare(a.id));
}
