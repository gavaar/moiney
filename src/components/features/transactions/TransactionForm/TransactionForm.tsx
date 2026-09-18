import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { AmountForm } from "@features/components/AmountForm";
import type { TransactionInitialState } from "@features/components/AmountForm/types";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { useTransactionHistory } from "@features/transactions/cache/useTransactionHistory";
import { getFrequentlyUsedSourcePipeIds, getQuickTransactionPipes } from "../QuickTransactionModal/helpers";

type Props = { onSuccess?: () => void } & (
  | { pipeId: Id<"pipes">; initState: TransactionInitialState }
  | { pipeId?: never; initState?: never }
);

export function TransactionForm(props: Props) {
  if (props.pipeId && props.initState?.intent === "edit") {
    return <AmountForm variant="transaction" pipeId={props.pipeId} initState={props.initState} onSuccess={props.onSuccess} />;
  }
  return <SelectableTransactionForm {...props} />;
}

function SelectableTransactionForm({ pipeId, initState, onSuccess }: Props) {
  const { allPipes, childrenByParent, isLoading } = usePipeCatalog();
  const { transactions, isLoading: historyLoading } = useTransactionHistory();
  const [selectedId, setSelectedId] = useState<Id<"pipes"> | null>(pipeId ?? null);
  const [activeStep, setActiveStep] = useState(pipeId ? 1 : 0);
  const isFeed = initState?.structure?.type === "feed";
  const pipes = isFeed
    ? (allPipes ?? []).filter(pipe => !pipe.parentId && !pipe.deletionJobId)
    : getQuickTransactionPipes(allPipes ?? [], childrenByParent, getFrequentlyUsedSourcePipeIds(transactions ?? []));
  const selected = pipes.find(pipe => pipe.id === selectedId);
  const initial: TransactionInitialState = initState ? {
    ...initState,
    pipeName: selected?.name ?? initState.pipeName,
    pipeIcon: selected?.icon ?? initState.pipeIcon,
    spent: selected?.spent ?? initState.spent,
    capacity: selected?.capacity ?? initState.capacity,
  } : {
    intent: "create", pipeName: selected?.name ?? "", pipeIcon: selected?.icon ?? "pipe-disconnected",
    spent: selected?.spent, capacity: selected?.capacity, title: "", value: "-",
  };

  return <AmountForm variant="transaction" pipeId={selected?.id ?? null} initState={initial} onSuccess={onSuccess}
    sourcePicker={{ pipes, loading: isLoading || historyLoading, activeStep, onStepChange: setActiveStep,
      onSelect: id => { setSelectedId(id); setActiveStep(1); },
    }} />;
}
