import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function addFeedToPipe(
  ctx: MutationCtx,
  userId: Id<"users">,
  pipeId: Id<"pipes">,
  amount: number,
) {
  if (amount <= 0) throw new Error("Amount must be positive");

  const pipe = await ctx.db.get(pipeId);
  if (!pipe) throw new Error("Pipe not found");
  if (pipe.userId !== userId) throw new Error("Not authorized");

  await ctx.db.patch(pipeId, {
    fed: (pipe.fed ?? 0) + amount,
  });
}
