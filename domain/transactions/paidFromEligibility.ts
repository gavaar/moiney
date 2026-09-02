export type PipeTopologyNode<PipeId> = {
  id: PipeId;
  parentId?: PipeId;
  blocked?: boolean;
};

function getRootId<PipeId>(
  pipesById: ReadonlyMap<PipeId, PipeTopologyNode<PipeId>>,
  pipeId: PipeId,
): PipeId | null {
  const visited = new Set<PipeId>();
  let currentId = pipeId;

  while (true) {
    if (visited.has(currentId)) return null;
    visited.add(currentId);
    const current = pipesById.get(currentId);
    if (!current) return null;
    if (!current.parentId) return currentId;
    currentId = current.parentId;
  }
}

export function isPaidFromEligible<PipeId>(
  pipes: readonly PipeTopologyNode<PipeId>[],
  logicalPipeId: PipeId,
  paidFromPipeId: PipeId,
  value: number,
): boolean {
  if (value === 0) return false;

  const pipesById = new Map(pipes.map((pipe) => [pipe.id, pipe]));
  const paidFromPipe = pipesById.get(paidFromPipeId);
  if (!paidFromPipe || paidFromPipe.blocked) return false;

  const logicalRootId = getRootId(pipesById, logicalPipeId);
  const paidFromRootId = getRootId(pipesById, paidFromPipeId);
  if (!logicalRootId || !paidFromRootId || logicalRootId === paidFromRootId) {
    return false;
  }

  if (value > 0) return paidFromPipe.parentId === undefined;
  return !pipes.some((pipe) => pipe.parentId === paidFromPipeId);
}
