import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { SettlementBalance, SettlementCause } from "../../../domain/events";
import { insertHistoryOperation } from "./persistence";

function balance(pipe: Pick<Doc<"pipes">, "fed" | "spent" | "capacity" | "pendingFedAdjustment">): SettlementBalance {
  return { capacity: pipe.capacity, fed: pipe.fed, spent: pipe.spent, pendingFedAdjustment: pipe.pendingFedAdjustment ?? 0 };
}

/** Records direct rule effects; subsequent tree redistribution is not a rule effect. */
export async function recordSettlementHistory(
  ctx: MutationCtx,
  before: Doc<"pipes">,
  after: Doc<"pipes">,
  cause: SettlementCause,
  now: number,
) {
  if (before.rule === "self_destruct") throw new Error("Self-destruct is not a settlement");
  await insertHistoryOperation(ctx, { canonicalEvent: {
    type: "settlement", userId: before.userId, pipeId: before._id, occurredAt: now,
    name: before.name, icon: before.icon, cause,
    before: balance(before), after: balance(after),
  } });
}
