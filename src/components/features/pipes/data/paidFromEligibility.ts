import { isPaidFromEligible } from "@domain/transactions";
import type { PipeModel } from "./pipes";

type PipeReference = Pick<
  PipeModel,
  "id" | "parentId" | "deletionJobId"
>;

export function isPaidFromPipeEligible(
  pipes: readonly PipeReference[],
  logicalPipeId: PipeModel["id"],
  paidFromPipeId: PipeModel["id"],
  value: number,
): boolean {
  return isPaidFromEligible(
    pipes.map((pipe) => ({
      id: pipe.id,
      ...(pipe.parentId ? { parentId: pipe.parentId } : {}),
      ...(pipe.deletionJobId ? { blocked: true } : {}),
    })),
    logicalPipeId,
    paidFromPipeId,
    value,
  );
}
