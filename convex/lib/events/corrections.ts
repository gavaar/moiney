import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../../_generated/dataModel";
import type { QueryCtx } from "../../_generated/server";

const correctionSnapshot = v.object({
  title: v.string(), value: v.number(), date: v.number(),
  kind: v.optional(v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer"))),
  from: v.optional(v.id("pipes")), to: v.optional(v.id("pipes")), paidFrom: v.optional(v.id("pipes")),
});
export const correctionHistoryItem = v.object({
  correctionId: v.id("transactionCorrections"), editedAt: v.number(),
  previous: correctionSnapshot, current: correctionSnapshot,
});

export function ownedCorrectionResult(correction: Doc<"transactionCorrections">, userId: Id<"users">) {
  if (correction.userId !== userId) throw new ConvexError({ code: "CORRECTION_OWNER_MISMATCH" });
  return { correctionId: correction._id, editedAt: correction.editedAt, previous: correction.previous, current: correction.current };
}

export async function latestCorrectionEditedAt(ctx: QueryCtx, userId: Id<"users">, operationId: Id<"events">) {
  const correction = await ctx.db.query("transactionCorrections")
    .withIndex("by_operationId", q => q.eq("operationId", operationId)).order("desc").first();
  return correction ? ownedCorrectionResult(correction, userId).editedAt : undefined;
}
