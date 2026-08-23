import { describe, expect, it } from "vitest";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { normalizePipe } from "./pipes";

describe("normalizePipe", () => {
  it("maps persisted fields to the frontend model without backend ownership data", () => {
    const persisted: Doc<"pipes"> = {
      _id: "pipe-1" as Id<"pipes">,
      _creationTime: 123,
      userId: "user-1" as Id<"users">,
      parentId: "parent-1" as Id<"pipes">,
      name: "Groceries",
      icon: "cart-outline",
      description: "Daily spending",
      priority: 2,
      capacity: 5000,
      fed: 3000,
      spent: 500,
      pendingFedAdjustment: 100,
      deletionJobId: "job-1" as Id<"pipeDeletionJobs">,
      rule: "cron",
      capUpdateValue: 200,
      cronNextDate: 456,
      cronInterval: { interval: 1, unit: "months" },
    };

    expect(normalizePipe(persisted)).toEqual({
      id: "pipe-1",
      parentId: "parent-1",
      name: "Groceries",
      icon: "cart-outline",
      description: "Daily spending",
      priority: 2,
      capacity: 5000,
      fed: 3000,
      spent: 500,
      pendingFedAdjustment: 100,
      deletionJobId: "job-1",
      rule: "cron",
      capUpdateValue: 200,
      cronNextDate: 456,
      cronInterval: { interval: 1, unit: "months" },
    });
  });
});
