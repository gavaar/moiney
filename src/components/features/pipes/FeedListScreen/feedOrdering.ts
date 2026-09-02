import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { TransactionModel } from "@features/transactions/data/transactions";

export function orderFeedsByTreeUsage(
  feeds: readonly PipeModel[],
  allPipes: readonly PipeModel[],
  transactions: readonly TransactionModel[],
): PipeModel[] {
  const pipesById = new Map(allPipes.map((pipe) => [pipe.id, pipe]));
  const rootByPipeId = new Map<Id<"pipes">, Id<"pipes"> | null>();

  function rootOf(pipeId: Id<"pipes">): Id<"pipes"> | null {
    const cached = rootByPipeId.get(pipeId);
    if (cached !== undefined) return cached;

    const path: Id<"pipes">[] = [];
    const visited = new Set<Id<"pipes">>();
    let currentId: Id<"pipes"> | undefined = pipeId;
    while (currentId) {
      if (visited.has(currentId)) return null;
      visited.add(currentId);
      path.push(currentId);
      const pipe = pipesById.get(currentId);
      if (!pipe) return null;
      if (!pipe.parentId) {
        for (const pathId of path) rootByPipeId.set(pathId, pipe.id);
        return pipe.id;
      }
      currentId = pipe.parentId;
    }
    return null;
  }

  const counts = new Map<Id<"pipes">, number>();
  const firstSeenAt = new Map<Id<"pipes">, number>();
  for (const [index, transaction] of transactions.entries()) {
    const involvedRoots = new Set<Id<"pipes">>();
    for (const pipeId of [transaction.from, transaction.to, transaction.paidFrom]) {
      if (!pipeId) continue;
      const rootId = rootOf(pipeId);
      if (rootId) involvedRoots.add(rootId);
    }
    for (const rootId of involvedRoots) {
      counts.set(rootId, (counts.get(rootId) ?? 0) + 1);
      if (!firstSeenAt.has(rootId)) firstSeenAt.set(rootId, index);
    }
  }

  return [...feeds].sort(
    (left, right) =>
      (counts.get(right.id) ?? 0) - (counts.get(left.id) ?? 0) ||
      (firstSeenAt.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (firstSeenAt.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}
