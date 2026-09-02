import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "@features/transactions/data/transactions";


export function getFrequentlyUsedSourcePipeIds(
  transactions: readonly TransactionModel[],
): Id<"pipes">[] {
  const counts = new Map<Id<"pipes">, number>();

  for (const transaction of transactions) {
    if (transaction.from === undefined) continue;
    counts.set(transaction.from, (counts.get(transaction.from) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([pipeId]) => pipeId);
}

export function getQuickTransactionPipes(
  pipes: readonly PipeModel[],
  childrenByParent: ReadonlyMap<Id<"pipes">, readonly PipeModel[]>,
  frequentlyUsedPipeIds: readonly Id<"pipes">[],
): PipeModel[] {
  const rankById = new Map(
    frequentlyUsedPipeIds.map((pipeId, index) => [pipeId, index]),
  );

  return pipes
    .filter(
      (pipe) =>
        !pipe.deletionJobId && (childrenByParent.get(pipe.id)?.length ?? 0) === 0,
    )
    .sort(
      (left, right) =>
        (rankById.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (rankById.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
}
