import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { calculatePipeRulePatch, recalculatePipes } from "../../../domain/pipes";

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
  const pipe = cachedPipe ?? (await ctx.db.get("pipes", pipeId));
  if (!pipe) throw new Error("Pipe not found");

  await ctx.db.patch(
    "pipes",
    pipeId,
    calculatePipeRulePatch(pipe, {
      now,
      capUpdateValue: opts.capUpdateValue,
    }),
  );
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
  const currentFed = new Map(allPipes.map((pipe) => [pipe._id, pipe.fed]));

  await Promise.all(
    updates
      .filter((update) => (currentFed.get(update._id) ?? 0) !== update.fed)
      .map((update) =>
        ctx.db.patch("pipes", update._id, { fed: update.fed }),
      ),
  );
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

export async function reconcileAffectedPipeRoots(
  ctx: MutationCtx,
  affectedPipeIds: Iterable<Id<"pipes">>,
  getPipe: (pipeId: Id<"pipes">) => Promise<Doc<"pipes"> | null> = (pipeId) =>
    ctx.db.get("pipes", pipeId),
): Promise<void> {
  const rootCache = new Map<Id<"pipes">, Id<"pipes">>();
  const rootIds = new Set<Id<"pipes">>();
  for (const pipeId of new Set(affectedPipeIds)) {
    rootIds.add(
      await resolveTopMostAncestor(ctx, pipeId, rootCache, getPipe),
    );
  }

  const trees = await Promise.all(
    [...rootIds].map(async (rootId) => {
      const root = await ctx.db.get("pipes", rootId);
      if (!root) throw new Error("Pipe not found");
      return [root, ...(await collectChildSubtree(ctx, rootId))];
    }),
  );
  if (trees.some((tree) => tree.some((pipe) => pipe.deletionJobId))) {
    throw new Error("Pipe is being deleted");
  }

  await Promise.all(
    trees.flatMap((tree) => {
      const currentFed = new Map(tree.map((pipe) => [pipe._id, pipe.fed]));
      return recalculatePipes(tree)
        .filter((update) => (currentFed.get(update._id) ?? 0) !== update.fed)
        .map((update) =>
          ctx.db.patch("pipes", update._id, { fed: update.fed }),
        );
    }),
  );
}
