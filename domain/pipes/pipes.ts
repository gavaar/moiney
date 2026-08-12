export function splitEvenly<TPipeId extends string>(
  children: Array<{ id: TPipeId; capacity?: number; fed?: number }>,
  budget: number,
): Array<{ childId: TPipeId; amount: number }> {
  if (budget === 0 || children.length === 0) return [];

  if (budget < 0) {
    const share = budget / children.length;
    return children.map((c) => ({ childId: c.id, amount: share }));
  }

  const withShortfall = children.map((c) => ({
    id: c.id,
    shortfall:
      c.capacity !== undefined
        ? Math.max(0, c.capacity - (c.fed ?? 0))
        : Infinity,
  }));
  withShortfall.sort((a, b) => a.shortfall - b.shortfall);

  const allocations: Array<{ childId: TPipeId; amount: number }> = [];
  let remaining = budget;
  const n = withShortfall.length;

  for (let i = 0; i < n; i++) {
    const fairShare = remaining / (n - i);
    const child = withShortfall[i];

    if (child.shortfall >= fairShare) {
      for (let j = i; j < n; j++) {
        allocations.push({ childId: withShortfall[j].id, amount: fairShare });
      }
      break;
    } else if (child.shortfall > 0) {
      allocations.push({ childId: child.id, amount: child.shortfall });
      remaining -= child.shortfall;
    }
  }

  return allocations;
}

export function calculatePipeAllocations<TPipeId extends string>(
  parentFed: number,
  children: Array<{
    id: TPipeId;
    priority: number;
    capacity?: number;
    fed?: number;
  }>,
): Array<{ childId: TPipeId; amount: number }> {
  if (parentFed === 0 || children.length === 0) return [];

  const groups = new Map<number, typeof children>();
  for (const child of children) {
    const group = groups.get(child.priority) ?? [];
    group.push(child);
    groups.set(child.priority, group);
  }

  const sortedPriorities = [...groups.keys()].sort((a, b) =>
    parentFed > 0 ? a - b : b - a,
  );
  const allocations: Array<{ childId: TPipeId; amount: number }> = [];
  let remaining = parentFed;

  for (const priority of sortedPriorities) {
    if (remaining === 0) break;
    const group = groups.get(priority)!;
    const groupAllocations = splitEvenly(group, remaining);
    for (const alloc of groupAllocations) {
      allocations.push(alloc);
      remaining -= alloc.amount;
    }
  }

  return allocations;
}

export function buildChildrenMap<TPipe extends { _id: string; parentId?: string }>(
  pipes: readonly TPipe[],
): Map<TPipe["_id"], TPipe[]> {
  const map = new Map<TPipe["_id"], TPipe[]>();
  for (const pipe of pipes) {
    if (pipe.parentId) {
      const siblings = map.get(pipe.parentId) ?? [];
      siblings.push(pipe);
      map.set(pipe.parentId, siblings);
    }
  }
  return map;
}

export function computePipeDerivedValues(
  pipe: { capacity?: number; spent?: number; fed?: number },
  children: Array<{ capacity?: number; spent?: number; fed?: number }>,
): { capacity?: number; spent: number; fed: number } {
  if (children.length === 0) {
    return {
      capacity: pipe.capacity,
      spent: pipe.spent ?? 0,
      fed: pipe.fed ?? 0,
    };
  }

  return {
    capacity: children.reduce((s, c) => s + (c.capacity ?? Infinity), 0),
    spent: children.reduce((s, c) => s + (c.spent ?? 0), 0),
    fed: children.reduce((s, c) => s + (c.fed ?? 0), 0) + (pipe.fed ?? 0),
  };
}

export function computePipeTree<TPipeId extends string>(
  pipes: Array<{
    _id: TPipeId;
    parentId?: TPipeId;
    capacity?: number;
    spent?: number;
    fed?: number;
  }>,
): Map<TPipeId, { capacity?: number; spent: number; fed: number }> {
  const childrenByParent = buildChildrenMap(pipes);
  const computed = new Map<TPipeId, { capacity?: number; spent: number; fed: number }>();

  function computePipe(pipe: (typeof pipes)[number]) {
    if (computed.has(pipe._id)) return computed.get(pipe._id)!;
    const children = (childrenByParent.get(pipe._id) ?? []).map(computePipe);
    const result = computePipeDerivedValues(pipe, children);
    computed.set(pipe._id, result);
    return result;
  }

  for (const pipe of pipes) {
    computePipe(pipe);
  }

  return computed;
}

type ReconciliationState<TPipeId extends string> = {
  childrenByParent: Map<
    TPipeId,
    Array<{ _id: TPipeId; priority: number; capacity?: number }>
  >;
  computed: Map<TPipeId, { capacity?: number }>;
  fedById: Map<TPipeId, number>;
  subtreeFedById: Map<TPipeId, number>;
};

function collectExcess<TPipeId extends string>(
  nodeId: TPipeId,
  state: ReconciliationState<TPipeId>,
  isRoot: boolean,
): { retainedFed: number; excess: number } {
  const children = state.childrenByParent.get(nodeId) ?? [];
  let nodeFed = state.fedById.get(nodeId) ?? 0;
  let descendantsFed = 0;

  for (const child of children) {
    const childResult = collectExcess(child._id, state, false);
    nodeFed += childResult.excess;
    descendantsFed += childResult.retainedFed;
  }

  const totalFed = nodeFed + descendantsFed;
  const capacity = state.computed.get(nodeId)?.capacity;
  const excess = !isRoot && capacity !== undefined
    ? Math.max(0, totalFed - capacity)
    : 0;

  state.fedById.set(nodeId, nodeFed - excess);
  state.subtreeFedById.set(nodeId, totalFed - excess);

  return { retainedFed: totalFed - excess, excess };
}

function distributeFed<TPipeId extends string>(
  nodeId: TPipeId,
  state: ReconciliationState<TPipeId>,
  isRoot: boolean,
): void {
  const rawChildren = state.childrenByParent.get(nodeId);
  if (!rawChildren || rawChildren.length === 0) return;

  const children = rawChildren.map((child) => ({
    id: child._id,
    priority: child.priority,
    capacity: state.computed.get(child._id)?.capacity ?? child.capacity,
    currentFed: state.subtreeFedById.get(child._id) ?? 0,
  }));
  const childById = new Map(children.map((child) => [child.id, child]));
  const available = state.fedById.get(nodeId) ?? 0;

  if (available > 0 || (available < 0 && isRoot)) {
    const allocations = calculatePipeAllocations(
      available,
      children.map((child) => ({
        id: child.id,
        priority: child.priority,
        capacity: child.capacity,
        fed: child.currentFed,
      })),
    );

    let totalAllocated = 0;
    for (const allocation of allocations) {
      const child = childById.get(allocation.childId)!;
      state.fedById.set(
        allocation.childId,
        (state.fedById.get(allocation.childId) ?? 0) + allocation.amount,
      );
      state.subtreeFedById.set(
        allocation.childId,
        child.currentFed + allocation.amount,
      );
      totalAllocated += allocation.amount;
    }
    state.fedById.set(nodeId, available - totalAllocated);
  }

  for (const child of children) {
    distributeFed(child.id, state, false);
  }
}

export function recalculatePipes<TPipeId extends string>(
  pipes: Array<{
    _id: TPipeId;
    parentId?: TPipeId;
    priority: number;
    capacity?: number;
    fed?: number;
  }>,
): Array<{ _id: TPipeId; fed: number }> {
  if (pipes.length === 0) return [];

  const computed = computePipeTree(pipes);
  const childrenByParent = buildChildrenMap(pipes);

  const fedById = new Map<TPipeId, number>();
  const rootIds: TPipeId[] = [];

  for (const pipe of pipes) {
    fedById.set(pipe._id, pipe.fed ?? 0);
    if (!pipe.parentId) {
      rootIds.push(pipe._id);
    }
  }

  const state: ReconciliationState<TPipeId> = {
    childrenByParent,
    computed,
    fedById,
    subtreeFedById: new Map(),
  };

  for (const rootId of rootIds) collectExcess(rootId, state, true);
  for (const rootId of rootIds) distributeFed(rootId, state, true);

  return pipes.map((p) => ({ _id: p._id, fed: fedById.get(p._id) ?? 0 }));
}

export function collectDescendants<TPipeId extends string>(
  id: TPipeId,
  childrenByParent: Map<TPipeId, TPipeId[]>,
): TPipeId[] {
  const ids: TPipeId[] = [];
  for (const childId of childrenByParent.get(id) ?? []) {
    ids.push(...collectDescendants(childId, childrenByParent));
    ids.push(childId);
  }
  return ids;
}
