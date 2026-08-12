import { buildChildrenMap, computePipeTree } from "../../../../domain/pipes";

type DeletionPipe<TPipeId extends string> = {
  _id: TPipeId;
  parentId?: TPipeId;
  priority: number;
  capacity?: number;
  fed?: number;
  spent?: number;
};

export function planPipeDeletion<TPipeId extends string>(
  pipes: DeletionPipe<TPipeId>[],
  rootPipeId: TPipeId,
): { memberIds: TPipeId[]; parentId: TPipeId | undefined; balance: number } {
  const root = pipes.find((pipe) => pipe._id === rootPipeId);
  if (!root) throw new Error("Pipe not found");

  const childrenByParent = buildChildrenMap(pipes);

  const memberIds: TPipeId[] = [];
  const visit = (pipeId: TPipeId) => {
    memberIds.push(pipeId);
    for (const child of childrenByParent.get(pipeId) ?? []) visit(child._id);
  };
  visit(rootPipeId);

  const derived = computePipeTree(pipes).get(rootPipeId)!;
  return {
    memberIds,
    parentId: root.parentId,
    balance: derived.fed - derived.spent,
  };
}
