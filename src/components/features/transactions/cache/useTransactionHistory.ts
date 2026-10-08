import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import type { HistoryFilters } from "../history/history-filters";
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

export type TransactionHistoryOptions = {
  enabled?: boolean;
  minimumCachedRows?: number;
};

const EMPTY_FILTERS: HistoryFilters = {};
const DEFAULT_OPTIONS: TransactionHistoryOptions = {};

export function useTransactionHistory(
  filters: HistoryFilters = EMPTY_FILTERS,
  options: TransactionHistoryOptions = DEFAULT_OPTIONS,
): TransactionHistoryState {
  const convex = useConvex();
  const { accountKey, isHydrating, read, append, mergeHead } = useTransactionCache();
  const cached = useMemo(
    () => read(HISTORY_SCOPE),
    [read],
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
  const enabled = options.enabled ?? true;
  const hasEnoughCachedRows =
    cached.complete &&
    (!cached.hasMore ||
      cached.transactions.length >= (options.minimumCachedRows ?? 0));

  const requestScope = useRef({ active: true });
  useEffect(() => {
    const scope = { active: true };
    requestScope.current = scope;
    requestInFlight.current = false;
    return () => { scope.active = false; };
  }, [accountKey, queryFilters, enabled, isHydrating]);

  const fetchPage = useCallback(
    async (numItems: number, pageCursor: string | null): Promise<Page> => {
      const result = await convex.query(api.transactions.listTransactionsPaginated, {
        paginationOpts: { numItems, cursor: pageCursor },
        ...(queryFilters ? { filters: queryFilters } : {}),
      });
      return {
        rows: (result.page as unknown as (TransactionModel | Doc<"transactions">)[]).map(
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
      const visited = new Set<string>();
      let nextCursor = pageCursor;
      while (true) {
        if (nextCursor !== null) visited.add(nextCursor);
        const page = await fetchPage(numItems, nextCursor);
        // Filtered server pages can be empty before later matching rows.
        // Only follow them while pagination is making progress.
        if (
          page.isDone ||
          !page.continueCursor ||
          visited.has(page.continueCursor) ||
          (!hasActiveFilters && page.rows.length === 0)
        ) {
          return { ...page, isDone: true };
        }
        if (page.rows.length > 0) return page;
        nextCursor = page.continueCursor;
      }
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

  const inputs = { accountKey, cached, enabled, fetchVisiblePage, hasEnoughCachedRows, isHydrating };
  const [previousInputs, setPreviousInputs] = useState<typeof inputs | null>(null);
  if (!previousInputs || previousInputs.accountKey !== accountKey || previousInputs.cached !== cached ||
    previousInputs.enabled !== enabled || previousInputs.fetchVisiblePage !== fetchVisiblePage ||
    previousInputs.hasEnoughCachedRows !== hasEnoughCachedRows || previousInputs.isHydrating !== isHydrating) {
    setPreviousInputs(inputs);
    setError(null);
    if (previousInputs && previousInputs.accountKey !== accountKey) {
      setTransactions(undefined);
      setCursor(null);
      setHasMore(false);
      setIsRefreshing(false);
    }
    if (isHydrating) {
      setIsLoading(true);
    } else if (!enabled || (!hasActiveFilters && hasEnoughCachedRows)) {
      setTransactions(cached.transactions);
      setHasMore(cached.hasMore);
      setLoadMoreStatus(cached.hasMore ? "CanLoadMore" : "Exhausted");
      setIsLoading(false);
    } else {
      setIsLoading(hasActiveFilters || cached.transactions.length === 0);
      setLoadMoreStatus("LoadingFirstPage");
      if (hasActiveFilters) {
        setTransactions(undefined);
        setCursor(null);
        setHasMore(false);
      }
    }
  }

  useEffect(() => {
    if (isHydrating || !enabled || (!hasActiveFilters && hasEnoughCachedRows)) return;
    let active = true;
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
  }, [
    accountKey,
    applyPage,
    cached,
    enabled,
    fetchVisiblePage,
    hasActiveFilters,
    hasEnoughCachedRows,
    isHydrating,
  ]);

  const loadMore = useCallback(() => {
    if (!enabled || isHydrating || requestInFlight.current || !hasMore || error) return;
    const scope = requestScope.current;
    requestInFlight.current = true;
    setError(null);
    setLoadMoreStatus("LoadingMore");

    const load = async () => {
      let nextCursor = cursor;
      if (!nextCursor) {
        const seed = await fetchVisiblePage(HISTORY_INITIAL_PAGE_SIZE, null);
        if (!scope.active) return;
        nextCursor = seed.continueCursor;
        setCursor(nextCursor);
        setHasMore(!seed.isDone);
        setTransactions((current) => mergeTransactions(current ?? [], seed.rows));
        if (!hasActiveFilters) {
          await append(HISTORY_SCOPE, seed.rows, !seed.isDone);
          if (!scope.active) return;
        }
        if (seed.isDone) {
          setLoadMoreStatus("Exhausted");
          return;
        }
      }

      const page = await fetchVisiblePage(HISTORY_LOAD_MORE_PAGE_SIZE, nextCursor);
      if (!scope.active) return;
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
        if (!scope.active) return;
        setLoadMoreStatus("CanLoadMore");
        setError(HISTORY_LOAD_ERROR);
      })
      .finally(() => {
        if (scope.active) requestInFlight.current = false;
      });
  }, [append, cursor, enabled, error, fetchVisiblePage, hasActiveFilters, hasMore, isHydrating]);

  const refresh = useCallback(() => {
    if (!enabled || isHydrating || requestInFlight.current) return;
    const scope = requestScope.current;
    requestInFlight.current = true;
    setError(null);
    setIsRefreshing(true);
    void fetchVisiblePage(HISTORY_INITIAL_PAGE_SIZE, null)
      .then((page) => { if (scope.active) applyPage(page); })
      .catch(() => {
        if (!scope.active) return;
        setIsRefreshing(false);
        setError(HISTORY_LOAD_ERROR);
      })
      .finally(() => {
        if (scope.active) requestInFlight.current = false;
      });
  }, [applyPage, enabled, fetchVisiblePage, isHydrating]);

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
