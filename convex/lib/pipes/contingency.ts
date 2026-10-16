import { ConvexError } from "convex/values";
import { calculateContingencyCoverage, prepareContingencyEligibility } from "../../../domain/pipes";
import { assertAmountLimit } from "../../../domain/money";
import type { Doc, Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { MAX_PIPES_PER_USER } from "../constants";

async function loadTopology(ctx: MutationCtx, userId: Id<"users">) {
  const pipes = await ctx.db.query("pipes").withIndex("by_userId", q => q.eq("userId", userId)).take(MAX_PIPES_PER_USER + 1);
  if (pipes.length > MAX_PIPES_PER_USER) throw new ConvexError({ code: "PIPE_LIMIT_REACHED" });
  return pipes;
}
export function preparePipeContingencyEligibility(pipes: readonly Doc<"pipes">[]) {
  return prepareContingencyEligibility(pipes.map(pipe => ({
    id: pipe._id,
    parentId: pipe.parentId,
    rule: pipe.rule,
    contingencyPipeId: pipe.contingencyPipeId,
    blocked: pipe.deletionJobId !== undefined,
  })));
}
export async function assertContingencyTarget(
  ctx: MutationCtx, userId: Id<"users">, sourceId: Id<"pipes">, targetId: Id<"pipes">,
) {
  if (!preparePipeContingencyEligibility(await loadTopology(ctx, userId))(sourceId).includes(targetId)) throw new ConvexError({ code: "INVALID_CONTINGENCY_TARGET" });
}

export type AppliedContingencyCoverage = { amountCents: number; before: Doc<"pipes">; after: Doc<"pipes"> };

/** Settles no donor rule and transfers no funding; only reassigns tracked spending. */
export async function applyContingencyCoverage(ctx: MutationCtx, source: Doc<"pipes">): Promise<AppliedContingencyCoverage | undefined> {
  if (!source.contingencyPipeId || source.rule === "instant_settlement" || source.rule === "self_destruct") return;
  const pipes = await loadTopology(ctx, source.userId);
  if (!preparePipeContingencyEligibility(pipes)(source._id).includes(source.contingencyPipeId)) return;
  const donor = pipes.find(pipe => pipe._id === source.contingencyPipeId)!;
  const amountCents = calculateContingencyCoverage(source, donor);
  if (amountCents === 0) return;
  const after = { ...donor, spent: assertAmountLimit(donor.spent + amountCents) };
  assertAmountLimit(source.spent - amountCents);
  await ctx.db.patch("pipes", donor._id, { spent: after.spent });
  return { amountCents, before: donor, after };
}
