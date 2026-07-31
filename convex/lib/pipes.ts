import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type CronUnit = "days" | "months" | "years";

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
      12,
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
    patch.capacity = pipe.capacity - leftoverFed + pipe.capUpdateValue;
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
    12,
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
  const anchorTs = Date.UTC(anchor.year, anchor.month, anchor.day, 12);

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

function reconcileNode<TPipeId extends string>(
  nodeId: TPipeId,
  childrenByParent: Map<TPipeId, Array<{ _id: TPipeId; priority: number; capacity?: number }>>,
  computed: Map<TPipeId, { capacity?: number }>,
  fedMap: Map<TPipeId, number>,
  isRoot?: boolean,
): void {
  const rawChildren = childrenByParent.get(nodeId);
  if (!rawChildren || rawChildren.length === 0) return;

  const children = rawChildren.map((child) => {
    const computedChild = computed.get(child._id);
    return {
      id: child._id,
      priority: child.priority,
      capacity: computedChild?.capacity ?? child.capacity,
    };
  });

  let parentFed = fedMap.get(nodeId) ?? 0;

  for (const child of children) {
    const childFed = fedMap.get(child.id) ?? 0;
    if (child.capacity !== undefined && childFed > child.capacity) {
      const excess = childFed - child.capacity;
      fedMap.set(child.id, child.capacity);
      parentFed += excess;
    }
  }

  const childrenCurrent = children.map((c) => ({
    id: c.id,
    priority: c.priority,
    capacity: c.capacity,
    currentFed: fedMap.get(c.id) ?? 0,
  }));

  const available = parentFed;

  if (available > 0 || (available < 0 && isRoot)) {
    const allocations = calculatePipeAllocations(
      available,
      childrenCurrent.map((c) => ({
        id: c.id,
        priority: c.priority,
        capacity: c.capacity,
        fed: c.currentFed,
      })),
    );

    let totalAllocated = 0;
    for (const alloc of allocations) {
      const child = childrenCurrent.find((c) => c.id === alloc.childId)!;
      fedMap.set(alloc.childId, child.currentFed + alloc.amount);
      totalAllocated += alloc.amount;
    }
    fedMap.set(nodeId, parentFed - totalAllocated);
  } else {
    fedMap.set(nodeId, parentFed);
  }

  for (const child of children) {
    reconcileNode(child.id, childrenByParent, computed, fedMap, false);
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

  const fedMap = new Map<TPipeId, number>();
  const rootIds: TPipeId[] = [];

  for (const pipe of pipes) {
    fedMap.set(pipe._id, pipe.fed ?? 0);
    if (!pipe.parentId) {
      rootIds.push(pipe._id);
    }
  }

  for (const rootId of rootIds) {
    reconcileNode(rootId, childrenByParent, computed, fedMap, true);
  }

  return pipes.map((p) => ({ _id: p._id, fed: fedMap.get(p._id) ?? 0 }));
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
