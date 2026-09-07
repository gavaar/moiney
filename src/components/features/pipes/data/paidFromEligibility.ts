import { preparePaidFromEligibility } from "@domain/transactions";
import type { PipeModel } from "./pipes";

type PipeReference = Pick<
  PipeModel,
  "id" | "parentId" | "deletionJobId"
>;

export function preparePaidFromPipeEligibility(
  pipes: readonly PipeReference[],
) {
  return preparePaidFromEligibility(
    pipes.map((pipe) => ({
      id: pipe.id,
      ...(pipe.parentId ? { parentId: pipe.parentId } : {}),
      ...(pipe.deletionJobId ? { blocked: true } : {}),
    })),
  );
}
