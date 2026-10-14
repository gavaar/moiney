import type { Doc } from "../../_generated/dataModel";
import type { MutationCtx } from "../../_generated/server";
import type { SettlementBalance, SettlementCause } from "../../../domain/events";
import { insertHistoryOperation } from "./persistence";
import type { AppliedContingencyCoverage } from "../pipes/contingency";

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
  coverage?: AppliedContingencyCoverage,
) {
  if (before.rule === "self_destruct") throw new Error("Self-destruct is not a settlement");
  await insertHistoryOperation(ctx, {
    canonicalEvent: {
      type: "settlement",
      userId: before.userId,
      pipeId: before._id,
      occurredAt: now,
      name: before.name,
      icon: before.icon,
      cause,
      before: balance(before),
      after: balance(after),
      ...(coverage ? {
        coverage: {
          amountCents: coverage.amountCents,
          pipeId: coverage.before._id,
          name: coverage.before.name,
          icon: coverage.before.icon,
          before: balance(coverage.before),
          after: balance(coverage.after)
        }
      } : {}),
    },
    ...(coverage ? {
      counterpart: {
        type: "settlement_coverage",
        userId: before.userId,
        pipeId: coverage.before._id,
        occurredAt: now,
        name: coverage.before.name,
        icon: coverage.before.icon,
        cause,
        before: balance(coverage.before),
        after: balance(coverage.after),
        coverage: {
          amountCents: coverage.amountCents,
          pipeId: before._id,
          name: before.name,
          icon: before.icon,
          before: balance(before),
          after: balance(after)
        },
      }
    } : {})
  });
}
