import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { readFinancialSnapshot } from "./lib/events/financialSnapshot";
import { latestCorrectionEditedAt } from "./lib/events/corrections";
import { editEventFinancialOperation, deleteEventFinancialOperation, createTransactionOperation, contributeToBoilerOperation } from "./lib/transactions/operations";

const operationArgs = { operationId: v.id("events") };
const actionResult = v.object({
  operationId: v.id("events"), createdAt: v.number(), title: v.string(), value: v.number(), date: v.number(),
  kind: v.union(v.literal("feed"), v.literal("expense"), v.literal("transfer")),
  from: v.optional(v.id("pipes")), to: v.optional(v.id("pipes")), paidFrom: v.optional(v.id("pipes")),
  editedAt: v.optional(v.number()),
});

export const create = mutation({
  args: {
    title: v.string(), value: v.number(), date: v.number(),
    from: v.optional(v.id("pipes")), to: v.optional(v.id("pipes")), paidFrom: v.optional(v.id("pipes")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await createTransactionOperation(ctx, userId, args, Date.now());
    return null;
  },
});

export const contributeToBoiler = mutation({
  args: { pipeId: v.id("pipes"), title: v.string(), value: v.number(), date: v.number(), currentFed: v.optional(v.number()) },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    const contribution = await contributeToBoilerOperation(ctx, userId, args, Date.now());
    return contribution !== null;
  },
});

export const get = query({
  args: operationArgs,
  returns: v.union(v.null(), actionResult),
  handler: async (ctx, { operationId }) => {
    const userId = await requireAuth(ctx);
    try {
      const { _creationTime: createdAt, operationId: _operationId, ...snapshot } =
        await readFinancialSnapshot(ctx, userId, operationId);
      return { ...snapshot, operationId, createdAt, editedAt: await latestCorrectionEditedAt(ctx, userId, operationId) };
    } catch (error) {
      if (error instanceof ConvexError && typeof error.data === "object" && error.data !== null && "code" in error.data && error.data.code === "OPERATION_NOT_FOUND") return null;
      throw error;
    }
  },
});

export const edit = mutation({
  args: {
    ...operationArgs, title: v.string(), value: v.number(), date: v.number(),
    primaryPipeId: v.optional(v.id("pipes")), applyReplacementEffects: v.optional(v.boolean()),
    target: v.optional(v.union(v.object({ type: v.literal("expense") }), v.object({ type: v.literal("transfer"), to: v.id("pipes") }),
      v.object({ type: v.literal("payByTransfer"), paidFrom: v.id("pipes") }))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await editEventFinancialOperation(ctx, userId, args, Date.now());
    return null;
  },
});

export const remove = mutation({
  args: operationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);
    await deleteEventFinancialOperation(ctx, userId, args.operationId);
    await ctx.scheduler.runAfter(0, internal.financialOperations.deleteCorrectionsBatch, args);
    return null;
  },
});

export const deleteCorrectionsBatch = internalMutation({
  args: operationArgs,
  returns: v.null(),
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("transactionCorrections")
      .withIndex("by_operationId", q => q.eq("operationId", args.operationId)).take(100);
    await Promise.all(rows.map(row => ctx.db.delete("transactionCorrections", row._id)));
    if (rows.length === 100) await ctx.scheduler.runAfter(0, internal.financialOperations.deleteCorrectionsBatch, args);
    return null;
  },
});
