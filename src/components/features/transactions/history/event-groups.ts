import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export type HistoryEntry = FunctionReturnType<typeof api.events.list>["events"][number];
type FinancialEntry = Extract<HistoryEntry, { title: string }>;
type LifecycleEntry = Exclude<HistoryEntry, FinancialEntry>;

type Operation<Entry = FinancialEntry> = Entry extends FinancialEntry
  ? Omit<Entry, "id" | "operationId"> & { id: Id<"events">; entries: FinancialEntry[] }
  : never;
export type FinancialOperation = Operation;

export type EventHistoryRow =
  | { kind: "operation"; id: Id<"events">; operation: FinancialOperation }
  | { kind: "lifecycle"; id: Id<"events">; event: LifecycleEntry }
  | {
    kind: "group";
    id: string;
    title: string;
    operations: FinancialOperation[];
    count: number;
    totalValue: number;
    oldestDate: number;
    latestDate: number;
    createdAt: number;
    visiblePipeIds: Id<"pipes">[];
  };

function operationFromEntries(entries: FinancialEntry[]): FinancialOperation {
  const representative = entries.find(entry => entry.id === entry.operationId) ?? entries[0];
  const { id, operationId, ...snapshot } = representative;
  if (representative.type === "transaction" && representative.targetPipeId !== undefined) {
    return {
      ...snapshot,
      id: operationId,
      type: "third_party_transaction",
      pipeId: representative.targetPipeId,
      targetPipeId: representative.pipeId,
      value: -representative.value,
      entries,
    };
  }
  if (representative.type === "transfer" && id !== operationId) {
    return {
      ...snapshot,
      id: operationId,
      type: "transfer",
      pipeId: representative.targetPipeId,
      targetPipeId: representative.pipeId,
      value: -representative.value,
      entries,
    };
  }
  return { ...snapshot, id: operationId, entries };
}

function participatingPipes(operation: FinancialOperation): Id<"pipes">[] {
  return operation.type !== "feed" && operation.targetPipeId !== undefined
    ? [operation.pipeId, operation.targetPipeId] : [operation.pipeId];
}

function compareOperations(first: FinancialOperation, second: FinancialOperation) {
  return second.occurredAt - first.occurredAt || second.createdAt - first.createdAt || second.id.localeCompare(first.id);
}

function groupKey(operation: FinancialOperation) {
  const month = new Date(operation.occurredAt).toISOString().slice(0, 7);
  return JSON.stringify(operation.type === "feed"
    ? ["feed", operation.title, operation.pipeId, month]
    : ["financial", operation.title, month]);
}

function rowOrder(row: EventHistoryRow) {
  if (row.kind === "group") return { date: row.latestDate, createdAt: row.createdAt };
  const entry = row.kind === "operation" ? row.operation : row.event;
  return { date: entry.occurredAt, createdAt: entry.createdAt };
}

/** Presentation only: partial operation pages are not accounting write models. */
export function groupHistoryEvents(
  entries: readonly HistoryEntry[],
  visiblePipeIds?: readonly Id<"pipes">[],
): EventHistoryRow[] {
  const scope = visiblePipeIds === undefined ? undefined : new Set(visiblePipeIds);
  const uniqueEntries = new Map(entries.map(entry => [entry.id, entry]));
  const operations = new Map<Id<"events">, FinancialEntry[]>();
  const rows: EventHistoryRow[] = [];
  for (const entry of uniqueEntries.values()) {
    if (entry.type === "pipe_creation" || entry.type === "pipe_deletion") {
      if (!scope || scope.has(entry.pipeId)) rows.push({ kind: "lifecycle", id: entry.operationId, event: entry });
      continue;
    }
    const members = operations.get(entry.operationId);
    if (members) members.push(entry);
    else operations.set(entry.operationId, [entry]);
  }

  const groups = new Map<string, FinancialOperation[]>();
  for (const members of operations.values()) {
    const operation = operationFromEntries(members);
    if (scope && !participatingPipes(operation).some(pipeId => scope.has(pipeId))) continue;
    const key = groupKey(operation);
    const group = groups.get(key);
    if (group) group.push(operation);
    else groups.set(key, [operation]);
  }

  for (const [id, members] of groups) {
    members.sort(compareOperations);
    const latest = members[0];
    if (members.length === 1) {
      rows.push({ kind: "operation", id: latest.id, operation: latest });
      continue;
    }
    const visible = new Set(members.flatMap(participatingPipes).filter(pipeId => !scope || scope.has(pipeId)));
    rows.push({
      kind: "group", id, title: latest.title, operations: members,
      count: members.length,
      totalValue: members.reduce((sum, operation) => sum + (operation.type === "transfer" ? 0 : operation.value), 0),
      oldestDate: members.at(-1)!.occurredAt,
      latestDate: latest.occurredAt,
      createdAt: latest.createdAt,
      visiblePipeIds: [...visible].sort(),
    });
  }

  return rows.sort((first, second) => {
    const a = rowOrder(first);
    const b = rowOrder(second);
    return b.date - a.date || b.createdAt - a.createdAt || second.id.localeCompare(first.id);
  });
}
