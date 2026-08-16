import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { recalculatePipes } from "../../../domain/pipes";
import { computeCronNextDate } from "../../../domain/scheduling";

export async function executePipeRule(
  ctx: MutationCtx,
  pipeId: Id<"pipes">,
  opts: {
    now?: number;
    pipe?: Doc<"pipes">;
    capUpdateValue?: number;
  } = {},
) {
  const { now = Date.now(), pipe: cachedPipe } = opts;
  const pipe = cachedPipe ?? (await ctx.db.get(pipeId));
  if (!pipe) throw new Error("Pipe not found");

  const leftoverFed = pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent;
  const patch: Record<string, unknown> = {
    fed: leftoverFed,
    spent: 0,
  };
  if (pipe.pendingFedAdjustment !== undefined) {
    patch.pendingFedAdjustment = 0;
  }

  const capUpdateValue = opts.capUpdateValue ?? pipe.capUpdateValue;
  if (capUpdateValue != null) {
    patch.capacity = pipe.capacity - pipe.spent + capUpdateValue;
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

// ── DB operations ──

export async function recascadeTree(ctx: MutationCtx, userId: Id<"users">) {
  const allPipes = await ctx.db
    .query("pipes")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .collect();

  if (allPipes.some((pipe) => pipe.deletionJobId)) {
    throw new Error("Pipe is being deleted");
  }

  const updates = recalculatePipes(allPipes);

  await Promise.all(updates.map((u) => ctx.db.patch(u._id, { fed: u.fed })));
}

export async function resolveTopMostAncestor(
  ctx: MutationCtx,
  startingPipeId: Id<"pipes">,
  cache?: Map<Id<"pipes">, Id<"pipes">>,
  getPipe: (pipeId: Id<"pipes">) => Promise<Doc<"pipes"> | null> = (pipeId) =>
    ctx.db.get("pipes", pipeId),
): Promise<Id<"pipes">> {
  const cached = cache?.get(startingPipeId);
  if (cached) return cached;

  const first = await getPipe(startingPipeId);
  if (!first) throw new Error("Pipe not found");

  const visited: Id<"pipes">[] = [first._id];
  let cursor: Doc<"pipes"> = first;
  while (cursor.parentId) {
    const parent = await getPipe(cursor.parentId);
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

  if (subtree.some((pipe) => pipe.deletionJobId)) {
    throw new Error("Pipe is being deleted");
  }

  const updates = recalculatePipes(subtree);
  const currentFed = new Map(subtree.map((p) => [p._id, p.fed]));

  await Promise.all(
    updates
      .filter((u) => (currentFed.get(u._id) ?? 0) !== u.fed)
      .map((u) => ctx.db.patch(u._id, { fed: u.fed })),
  );
}
