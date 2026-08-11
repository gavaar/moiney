import { v } from "convex/values";
import type { Id } from "../../../_generated/dataModel";

export type DeletionPhase =
  | "processingTransactions"
  | "readyToFinalize"
  | "complete";

export const deletionPhase = v.union(
  v.literal("processingTransactions"),
  v.literal("readyToFinalize"),
  v.literal("complete"),
);

export const deletionStartResult = v.object({
  jobId: v.id("pipeDeletionJobs"),
  phase: deletionPhase,
});

export const deletionStatus = v.union(
  v.null(),
  v.object({
    jobId: v.id("pipeDeletionJobs"),
    phase: deletionPhase,
    deleteTransactions: v.boolean(),
    totalMembers: v.number(),
    completedMembers: v.number(),
  }),
);

export type DeletionStartResult = {
  jobId: Id<"pipeDeletionJobs">;
  phase: DeletionPhase;
};
