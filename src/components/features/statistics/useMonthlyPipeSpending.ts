import { useEffect, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { PipeModel } from "@features/pipes/data/pipes";
import { getSubtreePipeIds } from "@features/pipes/data/subtree";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { readDeletedPipes, type DeletedPipeEntry } from "@features/pipes/data/deletedPipes";
import { preservedPipeScope } from "@domain/pipes/preservedScope";
import { useCurrentMonthReportContext } from "./CurrentMonthReportContext";

export function useMonthlyPipeSpending(pipeId: PipeModel["id"] | null, now: number): number | undefined {
  const { report, pipeSpending } = useCurrentMonthReportContext();
  const { childrenByParent, isLoading } = usePipeCatalog();
  const client = useConvex();
  const head = useQuery(api.events.deletedPipes, pipeId ? { limit: 100 } : "skip");
  const [catalog, setCatalog] = useState<{
    head: typeof head;
    entries?: DeletedPipeEntry[];
    error?: Error;
  }>();

  useEffect(() => {
    if (!head || head.isDone) return;
    let active = true;
    void readDeletedPipes(client, () => active, head).then(
      entries => { if (active) setCatalog({ head, entries }); },
      error => { if (active) setCatalog({ head, error: error instanceof Error ? error : new Error(String(error)) }); },
    );
    return () => { active = false; };
  }, [client, head]);

  if (catalog?.head === head && catalog?.error) throw catalog.error;
  const deleted = head?.isDone ? head.events : catalog?.head === head ? catalog?.entries : undefined;
  const date = new Date(now);
  const periodStart = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1);
  if (!pipeId || isLoading || !pipeSpending || !deleted || report?.periodStart !== periodStart) return undefined;
  const scope = preservedPipeScope<string>(getSubtreePipeIds(childrenByParent, pipeId) ?? [], deleted);
  return pipeSpending.reduce((total, entry) => total + (scope.has(entry.pipeId) ? entry.netSpendingCents : 0), 0);
}
