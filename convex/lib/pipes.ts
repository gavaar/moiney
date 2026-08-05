import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type CronUnit = "days" | "months" | "years";

const CRON_ANCHOR_HOUR = 5;
const CRON_EXECUTION_DELAY = 60 * 60 * 1000;

export function computeElapsedIntervals(
  starting: number,
  interval: number,
  unit: CronUnit,
  now = Date.now(),
): number {
  const start = new Date(starting);

  if (unit === "days") {
    const anchor = Date.UTC(
      start.getUTCFullYear(),
      start.getUTCMonth(),
      start.getUTCDate(),
      CRON_ANCHOR_HOUR,
    );
    const step = interval * 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((now - anchor) / step));
  }

  const nowDate = new Date(now);
  const elapsedMonths =
    (nowDate.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (nowDate.getUTCMonth() - start.getUTCMonth());
  const monthsPerStep = unit === "years" ? interval * 12 : interval;
  return Math.max(0, Math.floor(elapsedMonths / monthsPerStep));
}

export async function executePipeRule(
  ctx: MutationCtx,
  pipeId: Id<"pipes">,
  opts: { now?: number; pipe?: Doc<"pipes"> } = {},
) {
  const { now = Date.now(), pipe: cachedPipe } = opts;
  const pipe = cachedPipe ?? (await ctx.db.get(pipeId));
  if (!pipe) throw new Error("Pipe not found");

  const leftoverFed = pipe.fed - pipe.spent;
  const patch: Record<string, unknown> = {
    fed: leftoverFed,
    spent: 0,
  };

  if (pipe.capUpdateValue != null) {
    patch.capacity = leftoverFed + pipe.capUpdateValue;
  }

  if (pipe.rule === "cron" && pipe.cronInterval && pipe.cronNextDate != null) {
    patch.cronNextDate = computeCronNextDate(
      pipe.cronNextDate,
      pipe.cronInterval.interval,
      pipe.cronInterval.unit,
      now,
    );
  }

  await ctx.db.patch(pipeId, patch);
}

type CronAnchor = { year: number; month: number; day: number };

function occurrenceAt(
  anchor: CronAnchor,
  monthsPerStep: number,
  k: number,
): number {
  const monthIndex = anchor.year * 12 + anchor.month + k * monthsPerStep;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const daysInTargetMonth = new Date(
    Date.UTC(targetYear, targetMonth + 1, 0),
  ).getUTCDate();
  return Date.UTC(
    targetYear,
    targetMonth,
    Math.min(anchor.day, daysInTargetMonth),
    CRON_ANCHOR_HOUR,
  );
}

export function computeCronNextDate(
  starting: number,
  interval: number,
  unit: CronUnit,
  now = Date.now(),
): number {
  const start = new Date(starting);
  const anchor: CronAnchor = {
    year: start.getUTCFullYear(),
    month: start.getUTCMonth(),
    day: start.getUTCDate(),
  };
  const anchorTs = Date.UTC(
    anchor.year,
    anchor.month,
    anchor.day,
    CRON_ANCHOR_HOUR,
  );

  if (unit === "days") {
    const step = interval * 24 * 60 * 60 * 1000;
    const steps = Math.max(0, Math.floor((now - anchorTs) / step) + 1);
    return anchorTs + steps * step;
  }

  const monthsPerStep = unit === "years" ? interval * 12 : interval;
  let k = computeElapsedIntervals(starting, interval, unit, now);
  let next = occurrenceAt(anchor, monthsPerStep, k);
  if (next <= now) {
    next = occurrenceAt(anchor, monthsPerStep, k + 1);
  }
  return next;
}

export function computeCronIntervalProgress(
  cronNextDate: number,
  interval: number,
  unit: CronUnit,
  now: number,
): number {
  if (interval <= 0) return 0;

  const next = new Date(cronNextDate);
  const anchor: CronAnchor = {
    year: next.getUTCFullYear(),
    month: next.getUTCMonth(),
    day: next.getUTCDate(),
  };

  const stepDuration =
    unit === "days"
      ? interval * 24 * 60 * 60 * 1000
      : cronNextDate -
        occurrenceAt(anchor, unit === "years" ? interval * 12 : interval, -1);

  const fullWindow = 24 * 60 * 60 * 1000;
  const fillSpan = stepDuration - fullWindow;
  if (fillSpan <= 0) return 1;

  const startOfInterval = cronNextDate - stepDuration + CRON_EXECUTION_DELAY;
  const elapsed = now - startOfInterval;
  if (elapsed < 0) return 0;

  const cycleElapsed = elapsed % stepDuration;
  return Math.min(1, cycleElapsed / fillSpan);
}

// ── Allocation math ──

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

// ── Tree computation ──

function buildChildrenMap<TPipe extends { _id: string; parentId?: string }>(
  pipes: TPipe[],
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
  pipes: Array<{ _id: TPipeId; parentId?: TPipeId; capacity?: number; spent?: number; fed?: number }>,
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

// ── Fed distribution ──

type ReconciliationState<TPipeId extends string> = {
  childrenByParent: Map<TPipeId, Array<{ _id: TPipeId; priority: number; capacity?: number }>>;
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

// ── DB operations ──

export async function addFeedToPipe(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  amount: number,
) {
  if (amount === 0) throw new Error("Amount must be non-zero");

  const pipe = await ctx.db.get(pipeId);
  if (!pipe) throw new Error("Pipe not found");
  if (pipe.userId !== userId) throw new Error("Not authorized");

  await ctx.db.patch(pipeId, {
    fed: pipe.fed + amount,
  });
}

export async function recascadeTree(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const allPipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  const updates = recalculatePipes(allPipes);

  await Promise.all(updates.map((u) => ctx.db.patch(u._id, { fed: u.fed })));
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

export async function resolveTopMostAncestor(
  ctx: MutationCtx,
  startingPipeId: Id<"pipes">,
  cache?: Map<Id<"pipes">, Id<"pipes">>,
): Promise<Id<"pipes">> {
  const cached = cache?.get(startingPipeId);
  if (cached) return cached;

  const first = await ctx.db.get(startingPipeId);
  if (!first) throw new Error("Pipe not found");

  const visited: Id<"pipes">[] = [first._id];
  let cursor: Doc<"pipes"> = first;
  while (cursor.parentId) {
    const parent = await ctx.db.get(cursor.parentId);
    if (!parent) break;
    visited.push(parent._id);
    cursor = parent;
  }

  if (cache) {
    for (const id of visited) cache.set(id, cursor._id);
  }
  return cursor._id;
}

export async function collectChildSubtree(
  ctx: MutationCtx,
  rootId: Id<"pipes">,
): Promise<Doc<"pipes">[]> {
  const out: Doc<"pipes">[] = [];
  const stack: Id<"pipes">[] = [rootId];
  while (stack.length) {
    const id = stack.pop()!;
    const children = await ctx.db
      .query("pipes")
      .withIndex("by_parentId", (q) => q.eq("parentId", id))
      .collect();
    out.push(...children);
    for (const child of children) stack.push(child._id);
  }
  return out;
}

export async function recalcPipeSubtree(
  ctx: MutationCtx,
  pipeId: Id<"pipes">,
): Promise<void> {
  const cache = new Map<Id<"pipes">, Id<"pipes">>();
  const rootId = await resolveTopMostAncestor(ctx, pipeId, cache);
  const root = await ctx.db.get(rootId);
  const children = await collectChildSubtree(ctx, rootId);
  const subtree: Doc<"pipes">[] = root ? [root, ...children] : [];

  const updates = recalculatePipes(subtree);
  const currentFed = new Map(subtree.map((p) => [p._id, p.fed]));

  await Promise.all(
    updates
      .filter((u) => (currentFed.get(u._id) ?? 0) !== u.fed)
      .map((u) => ctx.db.patch(u._id, { fed: u.fed })),
  );
}
