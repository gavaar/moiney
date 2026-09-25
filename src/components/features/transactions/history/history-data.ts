import type { FunctionReturnType } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import { api } from "@convex/_generated/api";
import type { TransactionHistoryFilters } from "../cache/useTransactionHistory";
import { OrderedPages } from "./ordered-pages";

export type HistoryItem = FunctionReturnType<typeof api.history.list>["items"][number];
export type PipeHistoryEvent = Extract<HistoryItem, { kind: "pipe" }>["event"];
export type ArchiveSummary = { count: number; spent: number; oldestDate: number | null; latestDate: number | null };
export const ARCHIVE_ROLES = ["from", "to", "paidFrom"] as const;

export function queryFilters(filters: TransactionHistoryFilters) {
  return { ...filters, pipeIds: filters.pipeIds ? [...filters.pipeIds] : undefined };
}

export function historyItemKey(item: HistoryItem) {
  return item.kind === "pipe" ? `pipe:${item.event.id}` : `transaction:${item.transaction.id}`;
}

export function createHistoryReader(
  client: ConvexReactClient,
  filters: TransactionHistoryFilters,
  onTransactionPage?: (page: NonNullable<FunctionReturnType<typeof api.history.list>["transactionPage"]>, isHead: boolean) => void,
) {
  const sources: Array<"transactions" | "events"> = ["transactions", "events"];
  return new OrderedPages(sources,
    async (source, cursor) => {
      const page = await client.query(api.history.list, {
        source, cursor, limit: cursor ? 30 : 100, filters: queryFilters(filters),
      });
      if (page.transactionPage) onTransactionPage?.(page.transactionPage, cursor === undefined);
      return page;
    }, historyItemKey);
}

export function createArchiveReader(client: ConvexReactClient, eventId: PipeHistoryEvent["id"], filters: TransactionHistoryFilters) {
  return new OrderedPages([...ARCHIVE_ROLES], async (role, cursor) => {
    const page = await client.query(api.history.archivePage, {
      eventId, role, cursor, limit: 30, filters: queryFilters(filters),
    });
    return { ...page, items: page.transactions };
  }, (transaction) => transaction.id);
}

export async function readArchiveSummary(
  client: ConvexReactClient,
  eventId: PipeHistoryEvent["id"],
  filters: TransactionHistoryFilters,
  isActive: () => boolean,
): Promise<ArchiveSummary> {
  const summary: ArchiveSummary = { count: 0, spent: 0, oldestDate: null, latestDate: null };
  for (const role of ARCHIVE_ROLES) {
    let cursor: string | undefined;
    const visited = new Set<string>();
    while (true) {
      if (!isActive()) throw new Error("History read cancelled");
      const page = await client.query(api.history.archivePage, {
        eventId, role, cursor, limit: 100, filters: queryFilters(filters), summaryOnly: true,
      });
      if (!isActive()) throw new Error("History read cancelled");
      summary.count += page.count;
      summary.spent += page.spent;
      if (page.oldestDate !== null) summary.oldestDate = Math.min(summary.oldestDate ?? Infinity, page.oldestDate);
      if (page.latestDate !== null) summary.latestDate = Math.max(summary.latestDate ?? -Infinity, page.latestDate);
      if (page.isDone) break;
      if (!page.cursor || visited.has(page.cursor)) throw new Error("Archive summary pagination stalled");
      visited.add(page.cursor);
      cursor = page.cursor;
    }
  }
  return summary;
}
