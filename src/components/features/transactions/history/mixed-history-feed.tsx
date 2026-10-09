import { useMemo } from "react";
import { useIsFocused } from "expo-router/react-navigation";
import type { HistoryFilters } from "./history-filters";
import { useMixedHistory } from "./use-mixed-history";
import { HistoryList } from "./history-list";

export function MixedHistoryFeed({ filters = {}, recent = false, enabled = true }: { filters?: HistoryFilters; recent?: boolean; enabled?: boolean }) {
  const filterKey = JSON.stringify(filters);
  const stableFilters = useMemo(() => JSON.parse(filterKey) as HistoryFilters, [filterKey]);
  const history = useMixedHistory(stableFilters, { recent, enabled });
  const focused = useIsFocused();
  return focused ? <HistoryList key={history.generation} {...history} filters={stableFilters} /> : null;
}
