export type PipeTopologyNode<PipeId> = {
  id: PipeId;
  parentId?: PipeId;
  blocked?: boolean;
};

function getRootId<PipeId>(
  pipesById: ReadonlyMap<PipeId, PipeTopologyNode<PipeId>>,
  pipeId: PipeId,
  roots: Map<PipeId, PipeId | null>,
): PipeId | null {
  const visited = new Set<PipeId>();
  let currentId = pipeId;
  let root: PipeId | null = null;

  while (true) {
    if (roots.has(currentId)) {
      root = roots.get(currentId)!;
      break;
    }
    if (visited.has(currentId)) break;
    visited.add(currentId);
    const current = pipesById.get(currentId);
    if (!current) break;
    if (!current.parentId) {
      root = currentId;
      break;
    }
    currentId = current.parentId;
  }
  // Cache the entire path, including invalid ancestry, so shared ancestors are resolved once.
  for (const id of visited) roots.set(id, root);
  return root;
}

export function preparePaidFromEligibility<PipeId>(
  pipes: readonly PipeTopologyNode<PipeId>[],
): (logicalPipeId: PipeId, paidFromPipeId: PipeId, value: number) => boolean {
  const pipesById = new Map(pipes.map((pipe) => [pipe.id, pipe]));
  const parents = new Set(pipes.map((pipe) => pipe.parentId));
  const roots = new Map<PipeId, PipeId | null>();
  for (const pipe of pipes) getRootId(pipesById, pipe.id, roots);

  return (logicalPipeId, paidFromPipeId, value) => {
    if (value === 0) return false;
    const paidFromPipe = pipesById.get(paidFromPipeId);
    if (!paidFromPipe || paidFromPipe.blocked) return false;

    const logicalRootId = roots.get(logicalPipeId);
    const paidFromRootId = roots.get(paidFromPipeId);
    if (!logicalRootId || !paidFromRootId || logicalRootId === paidFromRootId) {
      return false;
    }

    if (value > 0) return paidFromPipe.parentId === undefined;
    return !parents.has(paidFromPipeId);
  };
}
