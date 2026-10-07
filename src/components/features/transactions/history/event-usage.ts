import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { getFrequentlyUsedSourcePipeIds } from "../QuickTransactionModal/helpers";
import { orderFeedsByTreeUsage } from "@features/pipes/FeedListScreen/feedOrdering";
import { groupHistoryEvents, type HistoryEntry } from "./event-groups";

function usageRoles(entries: readonly HistoryEntry[]) {
  const operations = groupHistoryEvents(entries).flatMap(row =>
    row.kind === "group" ? row.operations : row.kind === "operation" ? [row.operation] : []);
  operations.sort((left, right) => right.occurredAt - left.occurredAt || right.createdAt - left.createdAt || right.id.localeCompare(left.id));
  return operations.map(operation => operation.type === "feed"
    ? { to: operation.pipeId }
    : operation.type === "third_party_transaction"
      ? { from: operation.pipeId, paidFrom: operation.targetPipeId }
      : operation.type === "transfer"
        ? { from: operation.pipeId, to: operation.targetPipeId }
        : { from: operation.pipeId });
}

export function getFrequentlyUsedEventSourcePipeIds(entries: readonly HistoryEntry[]): Id<"pipes">[] {
  return getFrequentlyUsedSourcePipeIds(usageRoles(entries));
}

export function orderFeedsByEventTreeUsage(feeds: readonly PipeModel[], pipes: readonly PipeModel[], entries: readonly HistoryEntry[]): PipeModel[] {
  return orderFeedsByTreeUsage(feeds, pipes, usageRoles(entries));
}
