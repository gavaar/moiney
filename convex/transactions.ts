import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { requireAuth } from "./lib/auth";
import { calculateSpentUpdate } from "./lib/transactions";

export const createTransaction = mutation({
  args: {
    title: v.string(),
    value: v.number(),
    date: v.number(),
    pipeId: v.id("pipes"),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuth(ctx);

    const pipe = await ctx.db.get(args.pipeId);
    if (!pipe) throw new Error("Pipe not found");
    if (pipe.userId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(args.pipeId, {
      spent: calculateSpentUpdate(pipe.spent, args.value),
    });

    await ctx.db.insert("transactions", {
      title: args.title,
      value: args.value,
      date: args.date,
      pipeId: args.pipeId,
      userId,
    });
  },
});
