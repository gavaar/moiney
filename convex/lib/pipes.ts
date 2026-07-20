import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function addFeedToPipe(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  amount: number,
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const pipe = await ctx.db.get(pipeId);
  if (!pipe) throw new Error("Pipe not found");
  if (pipe.userId !== userId) throw new Error("Not authorized");

  await ctx.db.patch(pipeId, {
    fed: (pipe.fed ?? 0) + amount,
  });
}

// Distributes `budget` evenly across same-priority children.
// Children whose shortfall (capacity - fed) falls below the equal share
// get their full shortfall first; the remaining children split the rest equally.
export function splitEvenly<T extends string>(
  children: Array<{ id: T; capacity?: number; fed?: number }>,
  budget: number,
): Array<{ childId: T; amount: number }> {
  if (budget <= 0 || children.length === 0) return [];

  const withShortfall = children.map((c) => ({
    id: c.id,
    shortfall:
      c.capacity !== undefined
        ? Math.max(0, c.capacity - (c.fed ?? 0))
        : Infinity,
  }));
  withShortfall.sort((a, b) => a.shortfall - b.shortfall);

  const allocations: Array<{ childId: T; amount: number }> = [];
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

// Distributes a parent pipe's fed value to its children, ordered by priority (ascending).
// Within each priority tier, allocation is handled by splitEvenly.
// Returns the list of per-child allocations (childId + amount).
export function calculatePipeAllocations<T extends string>(
  parentFed: number,
  children: Array<{
    id: T;
    priority: number;
    capacity?: number;
    fed?: number;
  }>,
): Array<{ childId: T; amount: number }> {
  if (parentFed <= 0) return [];

  const groups = new Map<number, typeof children>();
  for (const child of children) {
    const group = groups.get(child.priority) ?? [];
    group.push(child);
    groups.set(child.priority, group);
  }

  const sortedPriorities = [...groups.keys()].sort((a, b) => a - b);
  const allocations: Array<{ childId: T; amount: number }> = [];
  let remaining = parentFed;

  for (const priority of sortedPriorities) {
    if (remaining <= 0) break;
    const group = groups.get(priority)!;
    const groupAllocations = splitEvenly(group, remaining);
    for (const alloc of groupAllocations) {
      allocations.push(alloc);
      remaining -= alloc.amount;
    }
  }

  return allocations;
}

// Returns the effective capacity, spent, and fed for a pipe.
// If the pipe has no children, its stored values are used directly.
// If the pipe has children, capacity and spent are summed from children
// (undefined values treated as 0), and fed is children's sum + pipe's own stored fed (excess).
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
    capacity: children.reduce((s, c) => s + (c.capacity ?? 0), 0),
    spent: children.reduce((s, c) => s + (c.spent ?? 0), 0),
    fed: children.reduce((s, c) => s + (c.fed ?? 0), 0) + (pipe.fed ?? 0),
  };
}

export async function distributeFedToChildren(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
) {
  const pipe = await ctx.db.get(pipeId);
  if (!pipe || pipe.userId !== userId) return;

  const children = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .filter((q) => q.eq(q.field("parentId"), pipeId))
    .collect();

  if (children.length === 0) return;

  const allocations = calculatePipeAllocations(
    pipe.fed ?? 0,
    children.map((c) => ({
      id: c._id,
      priority: c.priority,
      capacity: c.capacity,
      fed: c.fed,
    })),
  );

  if (allocations.length === 0) return;

  let totalAllocated = 0;
  for (const alloc of allocations) {
    totalAllocated += alloc.amount;
    const child = children.find((c) => c._id === alloc.childId)!;
    await ctx.db.patch(alloc.childId, {
      fed: (child.fed ?? 0) + alloc.amount,
    });
  }

  await ctx.db.patch(pipeId, {
    fed: (pipe.fed ?? 0) - totalAllocated,
  });

  for (const alloc of allocations) {
    if (alloc.amount > 0) {
      await distributeFedToChildren(ctx, userId, alloc.childId);
    }
  }
}
