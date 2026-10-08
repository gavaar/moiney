import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_PIPES_PER_USER } from "./constants";
import { syncPipeCreationHistory, type PipeLifecycleSnapshot } from "./events/lifecycle";

function snapshotChanged(existing: Doc<"pipeCreationEvents">, snapshot: PipeLifecycleSnapshot) {
  return existing.name !== snapshot.name || existing.icon !== snapshot.icon || existing.pipeType !== snapshot.pipeType ||
    existing.parentName !== snapshot.parentName || existing.parentIcon !== snapshot.parentIcon ||
    existing.occurredAt !== snapshot.occurredAt || existing.ancestorIds.join() !== snapshot.ancestorIds.join();
}

/** Legacy jobs still call this entry point; native events own the snapshot. */
export async function refreshPipeCreationEvent(
  ctx: MutationCtx,
  pipe: Doc<"pipes">,
  existing: Doc<"pipeCreationEvents">,
  parent: Doc<"pipes"> | null,
) {
  const { snapshot } = await ensureLivePipeCreationHistory(ctx, pipe, parent);
  if (snapshotChanged(existing, snapshot)) await ctx.db.patch("pipeCreationEvents", existing._id, snapshot);
  return snapshot;
}

/** Dual-write only for installed clients and pre-cutover deletion jobs. */
export async function ensurePipeCreationEvent(ctx: MutationCtx, pipe: Doc<"pipes">) {
  const { snapshot } = await ensureLivePipeCreationHistory(ctx, pipe);
  const existing = await ctx.db.query("pipeCreationEvents")
    .withIndex("by_pipeId", (q) => q.eq("pipeId", pipe._id)).unique();
  if (existing) {
    if (snapshotChanged(existing, snapshot)) await ctx.db.patch("pipeCreationEvents", existing._id, snapshot);
    return existing._id;
  }
  return ctx.db.insert("pipeCreationEvents", snapshot);
}

export async function ensureLivePipeCreationHistory(ctx: MutationCtx, pipe: Doc<"pipes">, knownParent?: Doc<"pipes"> | null) {
  const existing = await ctx.db.query("events").withIndex("by_userId_pipeId_type", q =>
    q.eq("userId", pipe.userId).eq("pipeId", pipe._id).eq("type", "pipe_creation")).unique();
  if (existing && existing.type !== "pipe_creation") throw new Error("Invalid pipe creation operation");
  const parent = pipe.parentId ? knownParent !== undefined ? knownParent : await ctx.db.get("pipes", pipe.parentId) : null;
  if (pipe.parentId && (!parent || parent.userId !== pipe.userId)) throw new Error("Missing pipe ancestor");
  const ancestors: Doc<"pipes">[] = [];
  const visited = new Set([pipe._id]);
  let parentId = pipe.parentId;
  while (!existing && parentId) {
    if (visited.has(parentId) || ancestors.length >= MAX_PIPES_PER_USER) {
      throw new Error("Invalid pipe ancestry");
    }
    visited.add(parentId);
    const ancestor = parentId === pipe.parentId ? parent : await ctx.db.get("pipes", parentId);
    if (!ancestor || ancestor.userId !== pipe.userId) throw new Error("Missing pipe ancestor");
    ancestors.push(ancestor);
    parentId = ancestor.parentId;
  }
  const snapshot: PipeLifecycleSnapshot = {
    userId: pipe.userId,
    pipeId: pipe._id,
    ancestorIds: existing?.ancestorIds ?? ancestors.map((ancestor) => ancestor._id).reverse(),
    occurredAt: existing?.occurredAt ?? pipe._creationTime,
    name: pipe.name,
    icon: pipe.icon,
    pipeType: pipe.parentId ? "pipe" : pipe.sourceType ?? "feed",
    parentName: parent?.name,
    parentIcon: parent?.icon,
  };
  const id = await syncPipeCreationHistory(ctx, snapshot, existing);
  return { id, snapshot };
}
