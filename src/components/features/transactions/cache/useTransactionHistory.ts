import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import {
  normalizeTransaction,
  type TransactionModel,
} from "@features/transactions/data/transactions";
import { useTransactionCache } from "./TransactionCacheContext";
import { HISTORY_SCOPE } from "./transactionSnapshot";

export const HISTORY_INITIAL_PAGE_SIZE = 100;
export const HISTORY_LOAD_MORE_PAGE_SIZE = 15;

export type HistoryLoadMoreStatus =
  | "LoadingFirstPage"
  | "CanLoadMore"
  | "LoadingMore"
  | "Exhausted";

type Page = {
  rows: TransactionModel[];
  continueCursor: string;
  isDone: boolean;
};

export type TransactionHistoryState = {
  transactions: TransactionModel[] | undefined;
  isLoading: boolean;
  isRefreshing: boolean;
  loadMoreStatus: HistoryLoadMoreStatus;
  loadMore: () => void;
  refresh: () => void;
};

export function useTransactionHistory(): TransactionHistoryState {
  const convex = useConvex();
  const { cache, isHydrating, read, append, mergeHead } = useTransactionCache();
  const cached = useMemo(
    () => read(HISTORY_SCOPE),
    [cache, read],
  );
  const [transactions, setTransactions] = useState<TransactionModel[] | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadMoreStatus, setLoadMoreStatus] =
    useState<HistoryLoadMoreStatus>("LoadingFirstPage");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestInFlight = useRef(false);

  const fetchPage = useCallback(
    async (numItems: number, pageCursor: string | null): Promise<Page> => {
      const result = await convex.query(api.transactions.listTransactionsPaginated, {
        paginationOpts: {
          numItems,
          cursor: pageCursor,
        },
      });
      return {
        rows: result.page.map(normalizeTransaction),
        continueCursor: result.continueCursor,
        isDone: result.isDone,
      };
    },
    [convex],
  );

  const applyPage = useCallback(
    (page: Page) => {
      setTransactions(page.rows);
      setCursor(page.continueCursor);
      setHasMore(!page.isDone);
      setLoadMoreStatus(page.isDone ? "Exhausted" : "CanLoadMore");
      setIsLoading(false);
      setIsRefreshing(false);
      void Promise.resolve(
        mergeHead(HISTORY_SCOPE, page.rows, !page.isDone),
      ).catch(() => undefined);
    },
    [mergeHead],
  );

  useEffect(() => {
    if (isHydrating) {
      setIsLoading(true);
      return;
    }

    if (cached.complete) {
      setTransactions(cached.transactions);
      setHasMore(cached.hasMore);
      setLoadMoreStatus(cached.hasMore ? "CanLoadMore" : "Exhausted");
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(cached.transactions.length === 0);
    setLoadMoreStatus("LoadingFirstPage");
    void fetchPage(HISTORY_INITIAL_PAGE_SIZE, null)
      .then((page) => {
        if (active) applyPage(page);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setLoadMoreStatus(cached.transactions.length > 0 ? "CanLoadMore" : "Exhausted");
      });

    return () => {
      active = false;
    };
  }, [applyPage, cached, fetchPage, isHydrating]);

  const loadMore = useCallback(() => {
    if (requestInFlight.current || !hasMore) return;
    requestInFlight.current = true;
    setLoadMoreStatus("LoadingMore");

    const load = async () => {
      let nextCursor = cursor;
      if (!nextCursor) {
        const seed = await fetchPage(HISTORY_INITIAL_PAGE_SIZE, null);
        nextCursor = seed.continueCursor;
        setCursor(nextCursor);
        setHasMore(!seed.isDone);
        setTransactions((current) => mergeTransactions(current ?? [], seed.rows));
        await append(HISTORY_SCOPE, seed.rows, !seed.isDone);
        if (seed.isDone) {
          setLoadMoreStatus("Exhausted");
          return;
        }
      }

      const page = await fetchPage(HISTORY_LOAD_MORE_PAGE_SIZE, nextCursor);
      setTransactions((current) => mergeTransactions(current ?? [], page.rows));
      setCursor(page.continueCursor);
      setHasMore(!page.isDone);
      setLoadMoreStatus(page.isDone ? "Exhausted" : "CanLoadMore");
      await append(HISTORY_SCOPE, page.rows, !page.isDone);
    };

    void load()
      .catch(() => setLoadMoreStatus("CanLoadMore"))
      .finally(() => {
        requestInFlight.current = false;
      });
  }, [append, cursor, fetchPage, hasMore]);

  const refresh = useCallback(() => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setIsRefreshing(true);
    void fetchPage(HISTORY_INITIAL_PAGE_SIZE, null)
      .then(applyPage)
      .catch(() => setIsRefreshing(false))
      .finally(() => {
        requestInFlight.current = false;
      });
  }, [applyPage, fetchPage]);

  return {
    transactions,
    isLoading,
    isRefreshing,
    loadMoreStatus,
    loadMore,
    refresh,
  };
}

function mergeTransactions(
  current: TransactionModel[],
  incoming: TransactionModel[],
): TransactionModel[] {
  const byId = new Map(current.map((transaction) => [transaction.id, transaction]));
  for (const transaction of incoming) byId.set(transaction.id, transaction);
  return [...byId.values()].sort(compareTransactions);
}

function compareTransactions(
  left: TransactionModel,
  right: TransactionModel,
): number {
  return (
    right.date - left.date ||
    right.createdAt - left.createdAt ||
    String(right.id).localeCompare(String(left.id))
  );
}
