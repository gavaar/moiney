import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_PIPES_PER_USER } from "./constants";
import { syncPipeCreationHistory, type PipeLifecycleSnapshot } from "./events/lifecycle";

/** Refresh both retained representations using presentation loaded by the caller. */
export async function refreshPipeCreationEvent(
  ctx: MutationCtx,
  pipe: Doc<"pipes">,
  existing: Doc<"pipeCreationEvents">,
  parent: Doc<"pipes"> | null,
) {
  const presentation = {
    name: pipe.name,
    icon: pipe.icon,
    parentName: parent?.name,
    parentIcon: parent?.icon,
  };
  if (existing.name !== presentation.name || existing.icon !== presentation.icon ||
    existing.parentName !== presentation.parentName || existing.parentIcon !== presentation.parentIcon) {
    await ctx.db.patch("pipeCreationEvents", existing._id, presentation);
  }
  const snapshot = { ...existing, ...presentation };
  await syncPipeCreationHistory(ctx, snapshot);
  return snapshot;
}

/** Also used by the legacy backfill and deletion of not-yet-backfilled pipes. */
export async function ensurePipeCreationEvent(ctx: MutationCtx, pipe: Doc<"pipes">) {
  const existing = await ctx.db.query("pipeCreationEvents")
    .withIndex("by_pipeId", (q) => q.eq("pipeId", pipe._id)).unique();
  if (existing) {
    const parent = pipe.parentId ? await ctx.db.get("pipes", pipe.parentId) : null;
    await refreshPipeCreationEvent(ctx, pipe, existing, parent);
    return existing._id;
  }
  const ancestors: Doc<"pipes">[] = [];
  const visited = new Set([pipe._id]);
  let parentId = pipe.parentId;
  while (parentId) {
    if (visited.has(parentId) || ancestors.length >= MAX_PIPES_PER_USER) {
      throw new Error("Invalid pipe ancestry");
    }
    visited.add(parentId);
    const parent = await ctx.db.get("pipes", parentId);
    if (!parent || parent.userId !== pipe.userId) throw new Error("Missing pipe ancestor");
    ancestors.push(parent);
    parentId = parent.parentId;
  }
  const snapshot: PipeLifecycleSnapshot = {
    userId: pipe.userId,
    pipeId: pipe._id,
    ancestorIds: ancestors.map((ancestor) => ancestor._id).reverse(),
    occurredAt: pipe._creationTime,
    name: pipe.name,
    icon: pipe.icon,
    pipeType: pipe.parentId ? "pipe" : pipe.sourceType ?? "feed",
    parentName: ancestors[0]?.name,
    parentIcon: ancestors[0]?.icon,
  };
  const eventId = await ctx.db.insert("pipeCreationEvents", snapshot);
  await syncPipeCreationHistory(ctx, snapshot);
  return eventId;
}
