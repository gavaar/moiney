import { useMemo } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import type { TransactionHistoryFilters } from "../cache/useTransactionHistory";
import { useMixedHistory } from "./use-mixed-history";
import { HistoryList } from "./history-list";

export function MixedHistoryFeed({ filters = {}, recent = false }: { filters?: TransactionHistoryFilters; recent?: boolean }) {
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => filters, [filterKey]);
  const history = useMixedHistory(stableFilters, { recent });
  const focused = useIsFocused();
  return focused ? <HistoryList key={history.generation} {...history} filters={stableFilters} /> : null;
}
