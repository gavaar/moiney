import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import {
  normalizeTransaction,
  type TransactionModel,
} from "@features/transactions/data/transactions";
import { useTransactionCache } from "./TransactionCacheContext";
import { HISTORY_SCOPE } from "./transactionSnapshot";

export const HISTORY_INITIAL_PAGE_SIZE = 100;
export const HISTORY_LOAD_MORE_PAGE_SIZE = 30;
const HISTORY_LOAD_ERROR = "Unable to load transaction history.";

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
  error: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  loadMoreStatus: HistoryLoadMoreStatus;
  loadMore: () => void;
  refresh: () => void;
};

export type TransactionHistoryFilters = {
  fromDate?: number;
  toDate?: number;
  pipeIds?: readonly Id<"pipes">[];
  title?: string;
};

const EMPTY_FILTERS: TransactionHistoryFilters = {};

export function useTransactionHistory(
  filters: TransactionHistoryFilters = EMPTY_FILTERS,
): TransactionHistoryState {
  const convex = useConvex();
  const { cache, isHydrating, read, append, mergeHead } = useTransactionCache();
  const cached = useMemo(
    () => read(HISTORY_SCOPE),
    [cache, read],
  );
  const [transactions, setTransactions] = useState<TransactionModel[] | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadMoreStatus, setLoadMoreStatus] =
    useState<HistoryLoadMoreStatus>("LoadingFirstPage");
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestInFlight = useRef(false);
  const queryFilters = useMemo(() => {
    const title = filters.title?.trim().toLowerCase();
    const pipeIds = filters.pipeIds?.length ? [...filters.pipeIds] : undefined;
    const normalized = {
      ...(filters.fromDate === undefined ? {} : { fromDate: filters.fromDate }),
      ...(filters.toDate === undefined ? {} : { toDate: filters.toDate }),
      ...(pipeIds ? { pipeIds } : {}),
      ...(title ? { title } : {}),
    };
    return Object.keys(normalized).length > 0 ? normalized : undefined;
  }, [filters.fromDate, filters.pipeIds, filters.title, filters.toDate]);
  const hasActiveFilters = queryFilters !== undefined;

  const fetchPage = useCallback(
    async (numItems: number, pageCursor: string | null): Promise<Page> => {
      const result = await convex.query(api.transactions.listTransactionsPaginated, {
        paginationOpts: { numItems, cursor: pageCursor },
        ...(queryFilters ? { filters: queryFilters } : {}),
      });
      return {
        rows: (result.page as unknown as Array<TransactionModel | Doc<"transactions">>).map(
          (transaction) =>
            "id" in transaction ? transaction : normalizeTransaction(transaction),
        ),
        continueCursor: result.continueCursor,
        isDone: result.isDone,
      };
    },
    [convex, queryFilters],
  );

  const fetchVisiblePage = useCallback(
    async (numItems: number, pageCursor: string | null): Promise<Page> => {
      let page = await fetchPage(numItems, pageCursor);
      while (hasActiveFilters && page.rows.length === 0 && !page.isDone) {
        page = await fetchPage(numItems, page.continueCursor);
      }
      return page;
    },
    [fetchPage, hasActiveFilters],
  );

  const applyPage = useCallback(
    (page: Page) => {
      setTransactions(page.rows);
      setCursor(page.continueCursor);
      setHasMore(!page.isDone);
      setLoadMoreStatus(page.isDone ? "Exhausted" : "CanLoadMore");
      setIsLoading(false);
      setIsRefreshing(false);
      if (!hasActiveFilters) {
        void Promise.resolve(
          mergeHead(HISTORY_SCOPE, page.rows, !page.isDone),
        ).catch(() => undefined);
      }
    },
    [hasActiveFilters, mergeHead],
  );

  useEffect(() => {
    if (isHydrating) {
      setError(null);
      setIsLoading(true);
      return;
    }

    if (!hasActiveFilters && cached.complete) {
      setError(null);
      setTransactions(cached.transactions);
      setHasMore(cached.hasMore);
      setLoadMoreStatus(cached.hasMore ? "CanLoadMore" : "Exhausted");
      setIsLoading(false);
      return;
    }

    let active = true;
    setError(null);
    setIsLoading(hasActiveFilters || cached.transactions.length === 0);
    setLoadMoreStatus("LoadingFirstPage");
    if (hasActiveFilters) {
      setTransactions(undefined);
      setCursor(null);
      setHasMore(false);
    }
    void fetchVisiblePage(HISTORY_INITIAL_PAGE_SIZE, null)
      .then((page) => {
        if (active) applyPage(page);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
        setLoadMoreStatus(cached.transactions.length > 0 ? "CanLoadMore" : "Exhausted");
        setError(HISTORY_LOAD_ERROR);
      });

    return () => {
      active = false;
    };
  }, [applyPage, cached, fetchVisiblePage, hasActiveFilters, isHydrating]);

  const loadMore = useCallback(() => {
    if (requestInFlight.current || !hasMore) return;
    requestInFlight.current = true;
    setError(null);
    setLoadMoreStatus("LoadingMore");

    const load = async () => {
      let nextCursor = cursor;
      if (!nextCursor) {
        const seed = await fetchVisiblePage(HISTORY_INITIAL_PAGE_SIZE, null);
        nextCursor = seed.continueCursor;
        setCursor(nextCursor);
        setHasMore(!seed.isDone);
        setTransactions((current) => mergeTransactions(current ?? [], seed.rows));
        if (!hasActiveFilters) {
          await append(HISTORY_SCOPE, seed.rows, !seed.isDone);
        }
        if (seed.isDone) {
          setLoadMoreStatus("Exhausted");
          return;
        }
      }

      const page = await fetchVisiblePage(HISTORY_LOAD_MORE_PAGE_SIZE, nextCursor);
      setTransactions((current) => mergeTransactions(current ?? [], page.rows));
      setCursor(page.continueCursor);
      setHasMore(!page.isDone);
      setLoadMoreStatus(page.isDone ? "Exhausted" : "CanLoadMore");
      if (!hasActiveFilters) {
        await append(HISTORY_SCOPE, page.rows, !page.isDone);
      }
    };

    void load()
      .catch(() => {
        setLoadMoreStatus("CanLoadMore");
        setError(HISTORY_LOAD_ERROR);
      })
      .finally(() => {
        requestInFlight.current = false;
      });
  }, [append, cursor, fetchVisiblePage, hasActiveFilters, hasMore]);

  const refresh = useCallback(() => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setError(null);
    setIsRefreshing(true);
    void fetchVisiblePage(HISTORY_INITIAL_PAGE_SIZE, null)
      .then(applyPage)
      .catch(() => {
        setIsRefreshing(false);
        setError(HISTORY_LOAD_ERROR);
      })
      .finally(() => {
        requestInFlight.current = false;
      });
  }, [applyPage, fetchVisiblePage]);

  return {
    transactions,
    error,
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
