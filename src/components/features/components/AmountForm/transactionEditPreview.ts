import { planTransactionEdit, type TransactionStructure } from "@domain/transactions";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { formatAmount } from "@/lib/format";

export function transactionEditPreview({ previous, previousValue, next, value, invalidPreviousPipeIds, applyReplacementEffects, pipesById, previousPipeName }: {
  previous: TransactionStructure<Id<"pipes">>;
  previousValue: number;
  next: TransactionStructure<Id<"pipes">>;
  value: number;
  invalidPreviousPipeIds: readonly Id<"pipes">[];
  applyReplacementEffects: boolean;
  pipesById: Readonly<Record<string, PipeModel>>;
  previousPipeName: string;
}): string[] | null {
  const previousPrimary = previous.type === "feed" ? previous.to : previous.from;
  const nextPrimary = next.type === "feed" ? next.to : next.from;
  if (invalidPreviousPipeIds.length === 0 && previousPrimary === nextPrimary &&
    (previous.type !== "transfer" || next.type === "transfer" && previous.to === next.to) &&
    (previous.type !== "payByTransfer" || next.type === "payByTransfer" && previous.paidFrom === next.paidFrom)) return null;
  const plan = planTransactionEdit(previous, previousValue, next, value, { invalidPreviousPipeIds, applyReplacementEffects });
  const lines = plan.deltas.map(delta => {
    const pipe = pipesById[delta.pipeId];
    const fields = [
      ["fed", delta.fedDelta],
      ["spent", delta.spentDelta],
      ["pending", delta.pendingFedAdjustmentDelta],
      ["contributed", pipe?.sourceType === "boiler" ? delta.contributedFedDelta : 0],
    ] as const;
    return `${pipe?.name ?? previousPipeName}: ${fields.filter(([, amount]) => amount !== 0).map(([field, amount]) => `${field} ${amount > 0 ? "+" : ""}${formatAmount(amount)}`).join(", ")}`;
  });
  if (invalidPreviousPipeIds.length) {
    lines.push(applyReplacementEffects
      ? "Replacement pipes receive the transaction effect. Invalid original pipes are not reversed."
      : "Replacement pipes receive no accounting update. Invalid original pipes are not reversed.");
  }
  lines.push("Rules may run; final balances can differ.");
  return lines;
}
