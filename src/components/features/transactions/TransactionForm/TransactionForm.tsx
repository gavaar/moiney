import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { AmountForm, groupPipesByRoot, type TransactionInitialState } from "@features/components/AmountForm";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useEventHistory } from "@features/transactions/cache/useEventHistory";
import { getFrequentlyUsedEventSourcePipeIds } from "../history/events/event-usage";
import { getQuickTransactionPipes } from "../QuickTransactionModal/helpers";
import type { OnDismissStateChange } from "@ui/Form/use-form-dismissal";

type Props = { onSuccess?: () => void; onDismissStateChange?: OnDismissStateChange } & (
  | { pipeId?: Id<"pipes">; initState: TransactionInitialState }
  | { pipeId?: never; initState?: never }
);

export function TransactionForm(props: Props) {
  const { pipeId, initState, onSuccess, onDismissStateChange } = props;
  const { allPipes, childrenByParent, isLoading } = usePipeCatalog();
  const { entries, isLoading: historyLoading } = useEventHistory();
  const [selectedId, setSelectedId] = useState<Id<"pipes"> | null>(pipeId ?? null);
  const isFeed = initState?.structure?.type === "feed";
  const pipes = isFeed
    ? (allPipes ?? []).filter(pipe => !pipe.parentId && !pipe.deletionJobId)
    : getQuickTransactionPipes(allPipes ?? [], childrenByParent, getFrequentlyUsedEventSourcePipeIds(entries.slice(0, 100)));
  const groups = isFeed ? [] : groupPipesByRoot(pipes, allPipes ?? [], {
    ...(pipeId ? { preferredPipeId: pipeId } : {}),
    expandFirst: !initState || initState.intent === "create",
  });
  const selected = pipes.find(pipe => pipe.id === selectedId);
  const initial: TransactionInitialState = initState ? {
    ...initState,
    pipeName: selected?.name ?? initState.pipeName,
    pipeIcon: selected?.icon ?? initState.pipeIcon,
    spent: selected?.spent ?? initState.spent,
    capacity: selected?.capacity ?? initState.capacity,
  } : {
    intent: "create",
    pipeName: selected?.name ?? "",
    pipeIcon: selected?.icon ?? "pipe-disconnected",
    spent: selected?.spent,
    capacity: selected?.capacity,
    title: "",
    value: "-",
  };

  return <AmountForm variant="transaction" pipeId={selected?.id ?? null} initState={initial} onSuccess={onSuccess} onDismissStateChange={onDismissStateChange}
    sourcePicker={{
      pipes,
      groups,
      loading: isLoading || historyLoading,
      navigationStart: pipeId ? 1 : 0,
      onSelect: setSelectedId,
    }} />;
}
