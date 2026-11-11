import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { buildPipeTree, PipeTreeItem } from "@features/pipes/PipeTree";
import type { TreeItemState } from "@ui/TreeList";
import type { PipeModel } from "@features/pipes/data/pipes";

export function getTransactionPipeColor(pipe?: Pick<PipeModel, "spent" | "fed">) {
  return !pipe ? colors.muted : pipe.spent >= pipe.fed ? colors.error : colors.text;
}

export function transactionPipeItems<Item extends { id: string; name: string; icon: string; parentId?: string }>(
  items: readonly Item[],
  pipesById: Readonly<Record<string, PipeModel>>,
  showSummary = false,
) {
  return items.map(item => {
    const pipe = pipesById[item.id];
    return {
      ...item,
      color: getTransactionPipeColor(pipe),
      summary: showSummary && pipe ? ` (${formatAmount(pipe.spent)} / ${formatAmount(pipe.capacity)})` : "",
    };
  });
}

type Item = ReturnType<typeof transactionPipeItems>[number];

function renderTransactionPipe(item: Item, state?: TreeItemState) {
  return <PipeTreeItem pipe={item} state={state} iconColor={item.color} summary={item.summary} />;
}

function transactionPipeStyle(item: Item) {
  return { borderColor: item.color };
}

/** Pairs ranked pipe-tree options with their rendering and styling; callers own eligibility. */
export function transactionPipePicker(
  candidates: readonly { id: string; name: string; icon: string }[],
  pipesById: Readonly<Record<string, PipeModel>>,
  { showSummary = false, preferredPipeId }: { showSummary?: boolean; preferredPipeId?: string } = {},
) {
  const specialItems = transactionPipeItems(candidates.filter(item => !pipesById[item.id]), pipesById);
  const relevant = buildPipeTree(transactionPipeItems(Object.values(pipesById), pipesById, showSummary),
    candidates.map(item => item.id), { preferredPipeId });
  return {
    items: [...specialItems, ...relevant.items],
    tree: [...specialItems.map(item => ({ id: item.id, label: item.name, selectable: true })), ...relevant.tree],
    renderItem: renderTransactionPipe,
    itemStyle: transactionPipeStyle,
  };
}
