import type { TreeBranchPath } from "@ui/TreeBranch";
import type { MonthlyEventArchive } from "@features/transactions/history/events/event-archives";
import type { EventHistoryRow } from "@features/transactions/history/events/event-groups";

export type HistoryRowItem = { key: string; depth: number; branch: TreeBranchPath } & (
  { kind: "month"; month: string } |
  { kind: "archive"; archive: MonthlyEventArchive } |
  { kind: "event"; row: EventHistoryRow }
);
type RowNode = { item: HistoryRowItem; children?: RowNode[] };
const rowDate = (row: EventHistoryRow | MonthlyEventArchive) => row.kind === "group" || row.kind === "archive" ? row.latestDate : row.kind === "operation" ? row.operation.occurredAt : row.event.occurredAt;

/** Prepare row identities once per data change; expansion only selects existing rows. */
export function prepareHistoryRows(history: readonly (EventHistoryRow | MonthlyEventArchive)[]) {
  const eventNode = (row: EventHistoryRow, prefix: string, branch: TreeBranchPath): RowNode => {
    const key = `${prefix}${row.id}`;
    return {
      item: { kind: "event", key, depth: branch.length, branch, row },
      children: row.kind === "group" ? row.operations.map((operation, index) => ({
        item: { kind: "event", key: `${key}:${operation.id}`, depth: branch.length + 1, branch: [...branch, index < row.operations.length - 1], row: { kind: "operation", id: operation.id, operation } },
      })) : undefined,
    };
  };
  const roots: RowNode[] = [];
  let currentMonth: string | undefined;
  for (const row of history) {
    const month = new Date(rowDate(row)).toISOString().slice(0, 7);
    if (month !== currentMonth) {
      roots.push({ item: { key: `month:${month}`, kind: "month", month, depth: 0, branch: [] } });
      currentMonth = month;
    }
    if (row.kind === "archive") roots.push({
      item: { kind: "archive", key: row.id, depth: 0, branch: [], archive: row },
      children: row.loadedSummary.count > 0 ? row.rows.map((child, index) => eventNode(child, `${row.id}:`, [index < row.rows.length - 1])) : undefined,
    });
    else roots.push(eventNode(row, "", []));
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
