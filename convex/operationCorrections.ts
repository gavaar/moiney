import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { query } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { readHistoryOperation } from "./lib/events/persistence";
import { correctionHistoryItem, ownedCorrectionResult } from "./lib/events/corrections";

export const list = query({
  args: { operationId: v.id("events"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(correctionHistoryItem),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const operation = await readHistoryOperation(ctx, userId, args.operationId);
    if (!operation || operation.canonicalEvent.id !== args.operationId ||
      operation.canonicalEvent.type === "pipe_creation" || operation.canonicalEvent.type === "pipe_deletion") {
      throw new ConvexError({ code: "OPERATION_NOT_FOUND" });
    }
    const numItems = args.paginationOpts.numItems;
    if (!Number.isInteger(numItems) || numItems < 1 || numItems > 100) throw new ConvexError({ code: "INVALID_CORRECTION_LIMIT" });
    const page = await ctx.db.query("transactionCorrections")
      .withIndex("by_operationId", q => q.eq("operationId", args.operationId)).order("desc")
      .paginate({ ...args.paginationOpts, maximumRowsRead: 100 });
    return { ...page, page: page.page.map(correction => ownedCorrectionResult(correction, userId)) };
  },
});
