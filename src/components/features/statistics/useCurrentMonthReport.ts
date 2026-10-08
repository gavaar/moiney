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

  const report = useMemo<MonthlySpendingStat | undefined>(() => {
    if (!allPipes || status !== "Exhausted") return undefined;
    const summary = results.reduce(
      (total, page) => mergeMonthlySpending(total, page.summary),
      summarizeMonthlySpending([]),
    );
    const spending = mergePipeSpending(...results.map((page) => page.pipeSpending));
    return {
      periodStart,
      ...summary,
      ...summarizeRootFeedSnapshot(allPipes),
      offenders: rankMonthlyOffenders(allPipes, spending),
      mostRepeatedTransaction: mostRepeatedTransaction(mergeTitleSpending(...results.map((page) => page.titleSpending ?? []))),
    };
  }, [allPipes, status, results, periodStart]);

  return { report };
}
