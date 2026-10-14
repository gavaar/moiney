import type { PipeRule } from "./rules";

const PREVIEW_CHILD_ID = "new-child";

export type ContingencyTopologyNode<PipeId extends string> = {
  id: PipeId; parentId?: PipeId; rule?: PipeRule; contingencyPipeId?: PipeId; blocked?: boolean;
};

/** Preview eligibility after creating a child, including the owner's topology resets. */
export function previewChildContingencyOptions<PipeId extends string>(
  pipes: readonly ContingencyTopologyNode<PipeId>[], parentId: PipeId, rule?: PipeRule,
): PipeId[] {
  const topology: ContingencyTopologyNode<string>[] = pipes.map(pipe => ({ ...pipe,
    ...(pipe.id === parentId ? { rule: undefined, contingencyPipeId: undefined } : {}),
    ...(pipe.contingencyPipeId === parentId ? { contingencyPipeId: undefined } : {}),
  }));
  topology.push({ id: PREVIEW_CHILD_ID, parentId, rule });
  const eligible = new Set(prepareContingencyEligibility(topology)(PREVIEW_CHILD_ID));
  return pipes.filter(pipe => eligible.has(pipe.id)).map(pipe => pipe.id).sort();
}

export function prepareContingencyEligibility<PipeId extends string>(
  pipes: readonly ContingencyTopologyNode<PipeId>[],
): (sourceId: PipeId) => PipeId[] {
  const byId = new Map(pipes.map(pipe => [pipe.id, pipe]));
  const parents = new Set(pipes.flatMap(pipe => pipe.parentId === undefined ? [] : [pipe.parentId]));
  const donors = new Set(pipes.flatMap(pipe => pipe.contingencyPipeId === undefined ? [] : [pipe.contingencyPipeId]));
  const leaves = pipes.filter(pipe => !pipe.blocked && !parents.has(pipe.id) && pipe.contingencyPipeId === undefined)
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  return sourceId => {
    let current = byId.get(sourceId);
    if (!current || current.blocked || parents.has(sourceId) || donors.has(sourceId) ||
      current.rule === "instant_settlement" || current.rule === "self_destruct") return [];
    const ancestorIds = new Set<PipeId>();
    const visited = new Set([sourceId]);
    while (current.parentId !== undefined) {
      const parent = byId.get(current.parentId);
      if (!parent || parent.blocked || visited.has(parent.id)) return [];
      visited.add(parent.id);
      ancestorIds.add(parent.id);
      current = parent;
    }
    return leaves.filter(pipe => pipe.id !== sourceId && pipe.parentId !== undefined && ancestorIds.has(pipe.parentId))
      .map(pipe => pipe.id);
  };
}
