import type { Doc, Id } from "@convex/_generated/dataModel";

export type PipeRule = "spend_overflow" | "instant_settlement" | "cron";
export type CronInterval = {
  interval: number;
  unit: "days" | "months" | "years";
};

export type PipeModel = {
  id: Id<"pipes">;
  parentId?: Id<"pipes">;
  name: string;
  icon: string;
  description?: string;
  priority: number;
  capacity: number;
  fed: number;
  spent: number;
  pendingFedAdjustment?: number;
  deletionJobId?: Id<"pipeDeletionJobs">;
  rule?: PipeRule;
  capUpdateValue?: number;
  cronNextDate?: number;
  cronInterval?: CronInterval;
};

export function normalizePipe(pipe: Doc<"pipes">): PipeModel {
  const normalized: PipeModel = {
    id: pipe._id,
    name: pipe.name,
    icon: pipe.icon,
    priority: pipe.priority,
    capacity: pipe.capacity,
    fed: pipe.fed,
    spent: pipe.spent,
  };

  if (pipe.parentId !== undefined) normalized.parentId = pipe.parentId;
  if (pipe.description !== undefined) normalized.description = pipe.description;
  if (pipe.pendingFedAdjustment !== undefined) {
    normalized.pendingFedAdjustment = pipe.pendingFedAdjustment;
  }
  if (pipe.deletionJobId !== undefined) normalized.deletionJobId = pipe.deletionJobId;
  if (pipe.rule !== undefined) normalized.rule = pipe.rule;
  if (pipe.capUpdateValue !== undefined) normalized.capUpdateValue = pipe.capUpdateValue;
  if (pipe.cronNextDate !== undefined) normalized.cronNextDate = pipe.cronNextDate;
  if (pipe.cronInterval !== undefined) normalized.cronInterval = pipe.cronInterval;

  return normalized;
}
