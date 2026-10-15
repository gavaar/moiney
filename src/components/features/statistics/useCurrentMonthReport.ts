import { useEffect, useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import {
  mergeMonthlySpending, mergePipeSpending, mergeTitleSpending, mostRepeatedTransaction, rankMonthlyOffenders,
  summarizeMonthlySpending, summarizeRootFeedSnapshot,
} from "@domain/statistics/monthlySpending";
import type { MonthlySpendingStat } from "./data/monthlySpending";
import { useUtcMonthStart } from "@/lib/useUtcMonthStart";

export function useCurrentMonthReport() {
  const { allPipes } = usePipeCatalog();
  const periodStart = useUtcMonthStart(true);

  const { results, status, loadMore } = usePaginatedQuery(
    api.monthlySpendingStats.eventMonthPage,
    { periodStart },
    { initialNumItems: 100 },
  );
  useEffect(() => {
    if (status === "CanLoadMore") loadMore(100);
  }, [status, loadMore]);

  const pipeSpending = useMemo(() => status === "Exhausted"
    ? mergePipeSpending(...results.map((page) => page.pipeSpending))
    : undefined, [status, results]);

  const report = useMemo<MonthlySpendingStat | undefined>(() => {
    if (!allPipes || !pipeSpending) return undefined;
    const summary = results.reduce(
      (total, page) => mergeMonthlySpending(total, page.summary),
      summarizeMonthlySpending([]),
    );
    return {
      periodStart,
      ...summary,
      ...summarizeRootFeedSnapshot(allPipes),
      offenders: rankMonthlyOffenders(allPipes, pipeSpending),
      mostRepeatedTransaction: mostRepeatedTransaction(mergeTitleSpending(...results.map((page) => page.titleSpending ?? []))),
    };
  }, [allPipes, pipeSpending, results, periodStart]);

  return { report, pipeSpending };
}
