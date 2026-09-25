import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { MAX_PIPES_PER_USER } from "./constants";

/** Also used by the legacy backfill and deletion of not-yet-backfilled pipes. */
export async function ensurePipeCreationEvent(ctx: MutationCtx, pipe: Doc<"pipes">) {
  const existing = await ctx.db.query("pipeCreationEvents")
    .withIndex("by_pipeId", (q) => q.eq("pipeId", pipe._id)).unique();
  if (existing) return existing._id;
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
  return await ctx.db.insert("pipeCreationEvents", {
    userId: pipe.userId,
    pipeId: pipe._id,
    ancestorIds: ancestors.map((ancestor) => ancestor._id).reverse(),
    occurredAt: pipe._creationTime,
    name: pipe.name,
    icon: pipe.icon,
    pipeType: pipe.parentId ? "pipe" : pipe.sourceType ?? "feed",
    parentName: ancestors[0]?.name,
    parentIcon: ancestors[0]?.icon,
  });
}
