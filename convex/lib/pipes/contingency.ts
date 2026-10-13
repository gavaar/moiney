import { ConvexError } from "convex/values";
import { prepareContingencyEligibility } from "../../../domain/pipes";
import type { Id } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import { MAX_PIPES_PER_USER } from "../constants";

export async function assertContingencyTarget(
  ctx: MutationCtx, userId: Id<"users">, sourceId: Id<"pipes">, targetId: Id<"pipes">,
) {
  const pipes = await ctx.db.query("pipes").withIndex("by_userId", q => q.eq("userId", userId)).take(MAX_PIPES_PER_USER + 1);
  if (pipes.length > MAX_PIPES_PER_USER) throw new ConvexError({ code: "PIPE_LIMIT_REACHED" });
  const eligible = prepareContingencyEligibility(pipes.map(pipe => ({
    id: pipe._id, parentId: pipe.parentId, rule: pipe.rule,
    contingencyPipeId: pipe.contingencyPipeId, blocked: pipe.deletionJobId !== undefined,
  })));
  if (!eligible(sourceId).includes(targetId)) throw new ConvexError({ code: "INVALID_CONTINGENCY_TARGET" });
}
