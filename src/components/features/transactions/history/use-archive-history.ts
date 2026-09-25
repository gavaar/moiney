import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { useIsFocused } from "expo-router/react-navigation";
import type { TransactionModel } from "../data/transactions";
import type { TransactionHistoryFilters } from "../cache/useTransactionHistory";
import { createArchiveReader, readArchiveSummary, type ArchiveSummary, type PipeHistoryEvent } from "./history-data";

export type ArchiveState = {
  transactions: TransactionModel[]; loading: boolean; hasMore: boolean; error?: string;
  summary?: ArchiveSummary; summaryError?: boolean;
};

/** Owned by one mounted, filtered History list; no account-persistent archive cache. */
export function useArchiveHistory(filters: TransactionHistoryFilters) {
  const client = useConvex();
  const focused = useIsFocused();
  const active = useRef(true);
  const readers = useRef(new Map<string, ReturnType<typeof createArchiveReader>>());
  const loadingPages = useRef(new Set<string>());
  const requestedSummaries = useRef(new Set<string>());
  const [archives, setArchives] = useState<Record<string, ArchiveState | undefined>>({});

  useEffect(() => {
    active.current = focused;
    return () => {
      active.current = false;
      for (const reader of readers.current.values()) reader.cancel();
    };
  }, [focused]);

  const patch = useCallback((id: string, update: Partial<ArchiveState>) => {
    if (!active.current) return;
    setArchives((current) => ({ ...current, [id]: {
      ...(current[id] ?? { transactions: [], loading: false, hasMore: true }), ...update,
    } }));
  }, []);

  const loadSummary = useCallback((event: PipeHistoryEvent) => {
    if (!active.current || requestedSummaries.current.has(event.id)) return;
    requestedSummaries.current.add(event.id);
    void readArchiveSummary(client, event.id, filters, () => active.current)
      .then((summary) => patch(event.id, { summary }))
      .catch(() => patch(event.id, { summaryError: true }));
  }, [client, filters, patch]);

  const loadPage = useCallback((event: PipeHistoryEvent) => {
    if (!active.current || loadingPages.current.has(event.id)) return;
    let reader = readers.current.get(event.id);
    if (!reader) {
      reader = createArchiveReader(client, event.id, filters);
      readers.current.set(event.id, reader);
    }
    loadingPages.current.add(event.id);
    patch(event.id, { loading: true, error: undefined });
    void reader.next(30).then((page) => {
      if (!active.current) return;
      setArchives((current) => ({ ...current, [event.id]: {
        ...current[event.id], transactions: [...(current[event.id]?.transactions ?? []), ...page.items],
        loading: false, hasMore: !page.isDone,
      } }));
    }).catch(() => patch(event.id, { loading: false, error: "Unable to load archived transactions. Pull to refresh." }))
      .finally(() => loadingPages.current.delete(event.id));
  }, [client, filters, patch]);

  return { archives, loadSummary, loadPage };
}
