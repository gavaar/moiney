import { describe, expect, it, vi } from "vitest";
import { processPipeDeletionOperation } from "./operations";

const scheduleNext = (ctx: any, jobId: string) =>
  ctx.scheduler.runAfter(0, "processPipeDeletion", { jobId });

describe("processPipeDeletionOperation transaction batches", () => {
  it("deletes orphaned transactions and preserves cross-boundary transactions", async () => {
    const job = {
      _id: "job-1",
      userId: "user-1",
      memberPipeIds: ["pipe-1"],
      memberIndex: 0,
      role: "from",
      phase: "processingTransactions",
      deleteTransactions: true,
    };
    const transactions = [
      { _id: "orphan", kind: "expense", from: "pipe-1" },
      {
        _id: "cross-boundary",
        kind: "transfer",
        from: "pipe-1",
        to: "survivor",
      },
    ];
    const paginate = vi.fn().mockResolvedValue({
      page: transactions,
      isDone: true,
      continueCursor: "next",
    });
    const ctx = {
      db: {
        get: vi.fn((_table: string, id: string) => {
          if (id === "job-1") return job;
          if (id === "pipe-1")
            return { _id: id, deletionJobId: "job-1", icon: "deleted-icon" };
          if (id === "survivor") return { _id: id, icon: "survivor-icon" };
          return null;
        }),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ paginate })),
        })),
        delete: vi.fn(),
        patch: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await processPipeDeletionOperation(
      ctx as any,
      "job-1" as any,
      scheduleNext,
    );

    expect(ctx.db.delete).toHaveBeenCalledWith("transactions", "orphan");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "transactions",
      "cross-boundary",
      {
        fromIcon: "deleted-icon",
      },
    );
    expect(ctx.db.patch).toHaveBeenCalledWith("pipeDeletionJobs", "job-1", {
      role: "to",
      cursor: undefined,
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledOnce();
  });

  it("stores the cursor when a role has another page", async () => {
    const job = {
      _id: "job-1",
      userId: "user-1",
      memberPipeIds: ["pipe-1"],
      memberIndex: 0,
      role: "from",
      phase: "processingTransactions",
      deleteTransactions: false,
    };
    const paginate = vi.fn().mockResolvedValue({
      page: [],
      isDone: false,
      continueCursor: "cursor-2",
    });
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(job),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ paginate })),
        })),
        patch: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await processPipeDeletionOperation(
      ctx as any,
      "job-1" as any,
      scheduleNext,
    );

    expect(paginate).toHaveBeenCalledWith({ numItems: 50, cursor: null });
    expect(ctx.db.patch).toHaveBeenCalledWith("pipeDeletionJobs", "job-1", {
      cursor: "cursor-2",
    });
    expect(ctx.scheduler.runAfter).toHaveBeenCalledOnce();
  });
});

describe("processPipeDeletionOperation finalization", () => {
  it("rejects when the current subtree balance drifted", async () => {
    const job = {
      _id: "job-1",
      userId: "user-1",
      parentPipeId: "parent",
      memberPipeIds: ["child"],
      initialBalance: 30,
      phase: "readyToFinalize",
      deleteTransactions: true,
    };
    const allPipes = [
      { _id: "parent", userId: "user-1", priority: 0, fed: 100, spent: 0 },
      {
        _id: "child",
        userId: "user-1",
        parentId: "parent",
        deletionJobId: "job-1",
        priority: 0,
        fed: 41,
        spent: 10,
      },
    ];
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(job),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn().mockResolvedValue(allPipes),
          })),
        })),
        delete: vi.fn(),
        patch: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await expect(
      processPipeDeletionOperation(ctx as any, "job-1" as any, scheduleNext),
    ).rejects.toThrow("Pipe deletion balance changed");
    expect(ctx.db.delete).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("credits the stored initial balance and completes atomically", async () => {
    const job = {
      _id: "job-1",
      userId: "user-1",
      parentPipeId: "parent",
      memberPipeIds: ["child"],
      initialBalance: 30,
      phase: "readyToFinalize",
      deleteTransactions: true,
    };
    const allPipes = [
      { _id: "parent", userId: "user-1", priority: 0, fed: 100, spent: 0 },
      {
        _id: "child",
        userId: "user-1",
        parentId: "parent",
        deletionJobId: "job-1",
        priority: 0,
        fed: 40,
        spent: 10,
      },
    ];
    const collect = vi.fn().mockResolvedValue(allPipes);
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(job),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({ collect })),
        })),
        delete: vi.fn(),
        patch: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await processPipeDeletionOperation(
      ctx as any,
      "job-1" as any,
      scheduleNext,
    );

    expect(ctx.db.patch).toHaveBeenCalledWith("pipes", "parent", { fed: 130 });
    expect(ctx.db.delete).toHaveBeenCalledWith("pipes", "child");
    expect(ctx.db.patch).toHaveBeenCalledWith("pipeDeletionJobs", "job-1", {
      phase: "complete",
    });
    expect(ctx.scheduler.runAfter).not.toHaveBeenCalled();
  });

  it("uses pending external adjustment when validating the final balance", async () => {
    const job = {
      _id: "job-1",
      userId: "user-1",
      parentPipeId: "parent",
      memberPipeIds: ["child"],
      initialBalance: 20,
      phase: "readyToFinalize",
      deleteTransactions: true,
    };
    const allPipes = [
      { _id: "parent", userId: "user-1", priority: 0, fed: 100, spent: 0 },
      {
        _id: "child",
        userId: "user-1",
        parentId: "parent",
        deletionJobId: "job-1",
        priority: 0,
        fed: 40,
        spent: 10,
        pendingFedAdjustment: -10,
      },
    ];
    const ctx = {
      db: {
        get: vi.fn().mockResolvedValue(job),
        query: vi.fn(() => ({
          withIndex: vi.fn(() => ({
            collect: vi.fn().mockResolvedValue(allPipes),
          })),
        })),
        delete: vi.fn(),
        patch: vi.fn(),
      },
      scheduler: { runAfter: vi.fn() },
    };

    await processPipeDeletionOperation(
      ctx as any,
      "job-1" as any,
      scheduleNext,
    );

    expect(ctx.db.patch).toHaveBeenCalledWith("pipes", "parent", { fed: 120 });
  });
});
