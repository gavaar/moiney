import type { MonthlyEventArchive } from "@features/transactions/history/events/event-archives";
import type { EventHistoryRow } from "@features/transactions/history/events/event-groups";

export type HistoryRowItem = { key: string; depth: number } & (
  { kind: "month"; month: string } |
  { kind: "archive"; archive: MonthlyEventArchive } |
  { kind: "event"; row: EventHistoryRow }
);
type RowNode = { item: HistoryRowItem; children?: RowNode[] };
const rowDate = (row: EventHistoryRow | MonthlyEventArchive) => row.kind === "group" || row.kind === "archive" ? row.latestDate : row.kind === "operation" ? row.operation.occurredAt : row.event.occurredAt;

/** Prepare row identities once per data change; expansion only selects existing rows. */
export function prepareHistoryRows(history: readonly (EventHistoryRow | MonthlyEventArchive)[]) {
  const eventNode = (row: EventHistoryRow, prefix: string, depth: number): RowNode => {
    const key = `${prefix}${row.id}`;
    return {
      item: { kind: "event", key, depth, row },
      children: row.kind === "group" ? row.operations.map(operation => ({
        item: { kind: "event", key: `${key}:${operation.id}`, depth: depth + 1, row: { kind: "operation", id: operation.id, operation } },
      })) : undefined,
    };
  };
  const roots: RowNode[] = [];
  let currentMonth: string | undefined;
  for (const row of history) {
    const month = new Date(rowDate(row)).toISOString().slice(0, 7);
    if (month !== currentMonth) {
      roots.push({ item: { key: `month:${month}`, kind: "month", month, depth: 0 } });
      currentMonth = month;
    }
    if (row.kind === "archive") roots.push({
      item: { kind: "archive", key: row.id, depth: 0, archive: row },
      children: row.loadedSummary.count > 0 ? row.rows.map(child => eventNode(child, `${row.id}:`, 1)) : undefined,
    });
    else roots.push(eventNode(row, "", 0));
  }

  return {
    visible(expanded: ReadonlySet<string>): HistoryRowItem[] {
      const result: HistoryRowItem[] = [];
      const add = (node: RowNode) => {
        result.push(node.item);
        if (node.children && expanded.has(node.item.key)) for (const child of node.children) add(child);
      };
      for (const root of roots) add(root);
      return result;
    },
  };
}
