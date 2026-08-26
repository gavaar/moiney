// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

describe("Convex boundaries: deletion and freeze", () => {
  it("adds a child in one tree while an unrelated tree is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, parentId, deletionJobId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const parentId = await ctx.db.insert("pipes", {
          userId,
          name: "Household",
          icon: "home-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 25,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, parentId, deletionJobId };
      },
    );

    const childId = await t.withIdentity({ subject: userId }).mutation(
      api.pipes.addPipe,
      {
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 200,
        parentId,
      },
    );

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      parent: await ctx.db.get("pipes", parentId),
      child: await ctx.db.get("pipes", childId),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.parent).toMatchObject({
      capacity: 0,
      fed: 75,
      spent: 0,
      pendingFedAdjustment: 0,
    });
    expect(state.child).toMatchObject({ fed: 200, spent: 0 });
    expect((state.parent?.fed ?? 0) + (state.child?.fed ?? 0)).toBe(275);
  });

  it("updates a rule in one tree while an unrelated tree is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, editableId, deletionJobId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const editableId = await ctx.db.insert("pipes", {
          userId,
          name: "Coffee",
          icon: "cafe",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 25,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, editableId, deletionJobId };
      },
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.updatePipeRule, {
        pipeId: editableId,
        rule: "instant_settlement",
        capUpdateValue: 25,
      }),
    ).resolves.toBeNull();

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      editable: await ctx.db.get("pipes", editableId),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.editable).toMatchObject({
      rule: "instant_settlement",
      capUpdateValue: 25,
      fed: 300,
      spent: 25,
    });
  });

  it("starts one idempotent deletion job and freezes its subtree", async () => {
    const t = convexTest(schema, modules);
    const { userId, rootId, childId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const rootId = await ctx.db.insert("pipes", {
        userId,
        name: "Root",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const childId = await ctx.db.insert("pipes", {
        userId,
        parentId: rootId,
        name: "Child",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 20,
        spent: 5,
      });
      return { userId, rootId, childId };
    });
    const asUser = t.withIdentity({ subject: userId });

    const first = await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId: rootId,
      deleteTransactions: false,
    });
    const second = await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId: rootId,
      deleteTransactions: false,
    });

    expect(second).toEqual(first);
    const state = await t.run(async (ctx) => ({
      jobs: await ctx.db.query("pipeDeletionJobs").collect(),
      root: await ctx.db.get("pipes", rootId),
      child: await ctx.db.get("pipes", childId),
    }));
    expect(state.jobs).toHaveLength(1);
    expect(first).toMatchObject({
      jobId: state.jobs[0]._id,
      phase: "processingTransactions",
    });
    expect(state.root?.deletionJobId).toBe(first.jobId);
    expect(state.child?.deletionJobId).toBe(first.jobId);

    await expect(
      t
        .withIdentity({ subject: "other-user" })
        .query(api.pipes.getPipeDeletionStatus, { jobId: first.jobId }),
    ).rejects.toThrow("Not authorized");

    await expect(
      t
        .withIdentity({ subject: userId })
        .query(api.pipes.getPipeDeletionStatus, {
          jobId: first.jobId,
        }),
    ).resolves.toMatchObject({
      jobId: first.jobId,
      phase: "processingTransactions",
      totalMembers: 2,
    });
  });

  it("rejects an overlapping deletion job instead of overwriting a freeze", async () => {
    const t = convexTest(schema, modules);
    const { userId, rootId, childId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const rootId = await ctx.db.insert("pipes", {
        userId,
        name: "Root",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      const childId = await ctx.db.insert("pipes", {
        userId,
        parentId: rootId,
        name: "Child",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      return { userId, rootId, childId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId: childId,
      deleteTransactions: false,
    });

    await expect(
      asUser.mutation(api.pipes.startPipeDeletion, {
        pipeId: rootId,
        deleteTransactions: false,
      }),
    ).rejects.toThrow("Pipe is being deleted");
  });

  it("finishes a scheduled preserve-history deletion with one parent credit", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { userId, parentId, childId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const parentId = await ctx.db.insert("pipes", {
        userId,
        name: "Parent",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 100,
        spent: 0,
      });
      const childId = await ctx.db.insert("pipes", {
        userId,
        parentId,
        name: "Deleted child",
        icon: "cafe",
        priority: 0,
        capacity: 100,
        fed: 40,
        spent: 10,
      });
      await ctx.db.insert("transactions", {
        title: "preserved expense",
        value: -10,
        date: 1,
        kind: "expense",
        from: childId,
        userId,
      });
      return { userId, parentId, childId };
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.pipes.startPipeDeletion, {
        pipeId: childId,
        deleteTransactions: false,
      });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const state = await t.run(async (ctx) => ({
      job: await ctx.db.query("pipeDeletionJobs").first(),
      parent: await ctx.db.get("pipes", parentId),
      child: await ctx.db.get("pipes", childId),
    }));

    expect(state.job?.phase).toBe("complete");
    expect(state.parent?.fed).toBe(130);
    expect(state.child).toBeNull();
    const history = await t
      .withIdentity({ subject: userId })
      .query(api.transactions.listTransactions, {});
    expect(history[0]).toMatchObject({
      title: "preserved expense",
      from: childId,
      fromIcon: "cafe",
    });
    vi.useRealTimers();
  });

  it("finishes the maximum-size deletion with conserved parent credit", async () => {
    vi.useFakeTimers();
    try {
      const t = convexTest(schema, modules);
      const { userId, parentId, deletedRootId } = await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "maximum-deletion-user",
          email: "maximum-deletion@example.com",
          password: "hash",
        });
        const parentId = await ctx.db.insert("pipes", {
          userId,
          name: "Surviving parent",
          icon: "pipe",
          priority: 0,
          capacity: 1000,
          fed: 100,
          spent: 0,
        });
        const deletedRootId = await ctx.db.insert("pipes", {
          userId,
          parentId,
          name: "Deleted root",
          icon: "trash-outline",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        for (let index = 0; index < 498; index += 1) {
          await ctx.db.insert("pipes", {
            userId,
            parentId: deletedRootId,
            name: `Deleted child ${index}`,
            icon: "pipe",
            priority: index,
            capacity: 100,
            fed: 0,
            spent: 0,
          });
        }
        return { userId, parentId, deletedRootId };
      });

      const before = await t.run(async (ctx) => {
        const pipes = await ctx.db.query("pipes").collect();
        return {
          parent: pipes.find((pipe) => pipe._id === parentId)!,
          totalBalance: pipes.reduce(
            (total, pipe) =>
              total +
              pipe.fed +
              (pipe.pendingFedAdjustment ?? 0) -
              pipe.spent,
            0,
          ),
        };
      });

      const result = await t
        .withIdentity({ subject: userId })
        .mutation(api.pipes.startPipeDeletion, {
          pipeId: deletedRootId,
          deleteTransactions: true,
        });
      const planned = await t.run((ctx) =>
        ctx.db.get("pipeDeletionJobs", result.jobId),
      );

      expect(planned?.memberPipeIds).toHaveLength(499);
      expect(planned?.initialBalance).toBe(500);
      const frozenCount = await t.run(async (ctx) =>
        (await ctx.db.query("pipes").collect()).filter(
          (pipe) => pipe.deletionJobId === result.jobId,
        ).length,
      );
      expect(frozenCount).toBe(499);

      // convex-test supports maxIterations at runtime, but its installed type omits it.
      await (t as any).finishAllScheduledFunctions(vi.runAllTimers, 2000);

      const after = await t.run(async (ctx) => {
        const pipes = await ctx.db.query("pipes").collect();
        return {
          job: await ctx.db.get("pipeDeletionJobs", result.jobId),
          pipes,
        };
      });
      expect(after.job?.phase).toBe("complete");
      expect(after.pipes).toHaveLength(1);
      expect(after.pipes[0]._id).toBe(parentId);
      expect(after.pipes[0].fed).toBe(
        before.parent.fed + planned!.initialBalance,
      );
      expect(
        after.pipes.reduce(
          (total, pipe) =>
            total + pipe.fed + (pipe.pendingFedAdjustment ?? 0) - pipe.spent,
          0,
        ),
      ).toBe(before.totalBalance);

      await t.mutation(internal.pipes.processPipeDeletion, {
        jobId: result.jobId,
      });
      const afterRetry = await t.run((ctx) =>
        ctx.db.get("pipes", parentId),
      );
      expect(afterRetry?.fed).toBe(after.pipes[0].fed);
    } finally {
      vi.useRealTimers();
    }
  });

  it("deletes only orphaned transactions across every transaction role", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);
    const { userId, deletedPipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const deletedPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Deleted",
        icon: "cafe",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      const survivorId = await ctx.db.insert("pipes", {
        userId,
        name: "Survivor",
        icon: "home-outline",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      const transactions = [
        { title: "feed-deleted", kind: "feed" as const, to: deletedPipeId },
        {
          title: "expense-deleted",
          kind: "expense" as const,
          from: deletedPipeId,
        },
        {
          title: "pay-category-deleted",
          kind: "expense" as const,
          from: deletedPipeId,
          paidFrom: survivorId,
        },
        {
          title: "pay-payer-deleted",
          kind: "expense" as const,
          from: survivorId,
          paidFrom: deletedPipeId,
        },
        {
          title: "pay-both-deleted",
          kind: "expense" as const,
          from: deletedPipeId,
          paidFrom: deletedPipeId,
        },
        {
          title: "transfer-to-survivor",
          kind: "transfer" as const,
          from: deletedPipeId,
          to: survivorId,
        },
        {
          title: "transfer-from-survivor",
          kind: "transfer" as const,
          from: survivorId,
          to: deletedPipeId,
        },
        {
          title: "transfer-both-deleted",
          kind: "transfer" as const,
          from: deletedPipeId,
          to: deletedPipeId,
        },
      ];
      for (const [index, transaction] of transactions.entries()) {
        await ctx.db.insert("transactions", {
          ...transaction,
          userId,
          value: -1,
          date: index,
        });
      }
      return { userId, deletedPipeId };
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.pipes.startPipeDeletion, {
        pipeId: deletedPipeId,
        deleteTransactions: true,
      });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const transactions = await t.run((ctx) =>
      ctx.db.query("transactions").collect(),
    );
    expect(transactions.map((transaction) => transaction.title).sort()).toEqual(
      [
        "pay-category-deleted",
        "pay-payer-deleted",
        "transfer-from-survivor",
        "transfer-to-survivor",
      ],
    );
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "pay-category-deleted",
          fromIcon: "cafe",
        }),
        expect.objectContaining({
          title: "pay-payer-deleted",
          paidFromIcon: "cafe",
        }),
        expect.objectContaining({
          title: "transfer-from-survivor",
          toIcon: "cafe",
        }),
        expect.objectContaining({
          title: "transfer-to-survivor",
          fromIcon: "cafe",
        }),
      ]),
    );
    vi.useRealTimers();
  });

  it("rejects new transactions against a frozen deletion subtree", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      return { userId, pipeId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId,
      deleteTransactions: false,
    });

    await expect(
      asUser.mutation(api.transactions.createTransaction, {
        title: "new expense",
        value: -10,
        date: 100,
        from: pipeId,
      }),
    ).rejects.toThrow("Pipe is being deleted");
  });

  it("allows an expense in one root while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, spendingId, deletionJobId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const frozenId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const spendingId = await ctx.db.insert("pipes", {
        userId,
        name: "Spending",
        icon: "wallet-outline",
        priority: 1,
        capacity: 500,
        fed: 300,
        spent: 25,
      });
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozenId],
        initialBalance: 50,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", frozenId, { deletionJobId });
      return { userId, frozenId, spendingId, deletionJobId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.transactions.createTransaction, {
        title: "groceries",
        value: -40,
        date: 100,
        from: spendingId,
      }),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      spending: await ctx.db.get("pipes", spendingId),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.spending).toMatchObject({ fed: 300, spent: 65 });
    expect(state.transactions).toEqual([
      expect.objectContaining({
        title: "groceries",
        kind: "expense",
        value: -40,
        from: spendingId,
      }),
    ]);
  });

  it("allows a feed in one root while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, destinationId, deletionJobId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          name: "Income",
          icon: "wallet-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, destinationId, deletionJobId };
      },
    );
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.transactions.createTransaction, {
        title: "salary",
        value: 40,
        date: 100,
        to: destinationId,
      }),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.destination).toMatchObject({ fed: 340, spent: 0 });
    expect(state.transactions).toEqual([
      expect.objectContaining({
        title: "salary",
        kind: "feed",
        value: 40,
        to: destinationId,
      }),
    ]);
  });

  it("allows a transfer across two roots while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, sourceId, destinationId, deletionJobId } =
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const sourceId = await ctx.db.insert("pipes", {
          userId,
          name: "Source",
          icon: "wallet-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          name: "Destination",
          icon: "bank",
          priority: 2,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, sourceId, destinationId, deletionJobId };
      });
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.transactions.createTransaction, {
        title: "move money",
        value: -40,
        date: 100,
        from: sourceId,
        to: destinationId,
      }),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.source).toMatchObject({ fed: 260, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 340, spent: 0 });
    expect((state.source?.fed ?? 0) + (state.destination?.fed ?? 0)).toBe(600);
    expect(state.transactions).toEqual([
      expect.objectContaining({
        title: "move money",
        kind: "transfer",
        value: -40,
        from: sourceId,
        to: destinationId,
      }),
    ]);
  });

  it("allows pay-by-transfer across two roots while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, logicalId, payerId, deletionJobId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const logicalId = await ctx.db.insert("pipes", {
          userId,
          name: "Coffee",
          icon: "cafe",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 25,
        });
        const payerId = await ctx.db.insert("pipes", {
          userId,
          name: "Bank",
          icon: "bank",
          priority: 2,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, logicalId, payerId, deletionJobId };
      },
    );
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      asUser.mutation(api.transactions.createTransaction, {
        title: "coffee",
        value: -40,
        date: 100,
        from: logicalId,
        paidFrom: payerId,
      }),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      logical: await ctx.db.get("pipes", logicalId),
      payer: await ctx.db.get("pipes", payerId),
      transactions: await ctx.db.query("transactions").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.logical).toMatchObject({
      fed: 300,
      spent: 65,
      pendingFedAdjustment: 40,
    });
    expect(state.payer).toMatchObject({ fed: 260, spent: 0 });
    expect(state.transactions).toEqual([
      expect.objectContaining({
        title: "coffee",
        kind: "expense",
        value: -40,
        from: logicalId,
        paidFrom: payerId,
      }),
    ]);
  });

  it("rejects topology edits against a frozen deletion subtree", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      return { userId, pipeId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId,
      deleteTransactions: false,
    });

    await expect(
      asUser.mutation(api.pipes.updatePipe, {
        pipeId,
        name: "renamed",
      }),
    ).rejects.toThrow("Pipe is being deleted");
  });

  it("allows metadata updates in another tree while deletion is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, editableId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const frozenId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const editableId = await ctx.db.insert("pipes", {
        userId,
        name: "Editable",
        icon: "wallet-outline",
        priority: 1,
        capacity: 500,
        fed: 300,
        spent: 25,
      });
      return { userId, frozenId, editableId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId: frozenId,
      deleteTransactions: false,
    });
    await asUser.mutation(api.pipes.updatePipe, {
      pipeId: editableId,
      name: "Renamed",
      icon: "cash-outline",
      description: "Presentation only",
    });

    const editable = await t.run((ctx) => ctx.db.get("pipes", editableId));
    expect(editable).toMatchObject({
      name: "Renamed",
      icon: "cash-outline",
      description: "Presentation only",
      capacity: 500,
      fed: 300,
      spent: 25,
    });
  });

  it("allows a capacity update in one tree while an unrelated tree is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, editableId, deletionJobId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const editableId = await ctx.db.insert("pipes", {
          userId,
          name: "Editable",
          icon: "wallet-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 25,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return { userId, frozenId, editableId, deletionJobId };
      },
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.updatePipe, {
        pipeId: editableId,
        capacity: 600,
      }),
    ).resolves.toBeNull();

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      editable: await ctx.db.get("pipes", editableId),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.editable).toMatchObject({
      capacity: 600,
      fed: 300,
      spent: 25,
    });
  });

  it("allows an expense edit in one root while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, spendingId, transactionId, deletionJobId } =
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const spendingId = await ctx.db.insert("pipes", {
          userId,
          name: "Spending",
          icon: "wallet-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 25,
        });
        const transactionId = await ctx.db.insert("transactions", {
          userId,
          title: "groceries",
          kind: "expense",
          value: -20,
          date: 100,
          from: spendingId,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return {
          userId,
          frozenId,
          spendingId,
          transactionId,
          deletionJobId,
        };
      });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "groceries",
          value: -40,
          date: 100,
        },
      ),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      spending: await ctx.db.get("pipes", spendingId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.spending).toMatchObject({ fed: 300, spent: 45 });
    expect(state.transaction).toMatchObject({ value: -40, editedAt: expect.any(Number) });
    expect(state.corrections).toEqual([
      expect.objectContaining({
        transactionId,
        previous: { title: "groceries", value: -20, date: 100 },
        current: { title: "groceries", value: -40, date: 100 },
      }),
    ]);
  });

  it("allows a feed edit in one root while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const { userId, frozenId, destinationId, transactionId, deletionJobId } =
      await t.run(async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const frozenId = await ctx.db.insert("pipes", {
          userId,
          name: "Frozen",
          icon: "trash-outline",
          priority: 0,
          capacity: 100,
          fed: 50,
          spent: 0,
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          name: "Income",
          icon: "wallet-outline",
          priority: 1,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const transactionId = await ctx.db.insert("transactions", {
          userId,
          title: "salary",
          kind: "feed",
          value: 100,
          date: 100,
          to: destinationId,
        });
        const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
          userId,
          deleteTransactions: false,
          memberPipeIds: [frozenId],
          initialBalance: 50,
          phase: "processingTransactions",
          memberIndex: 0,
          role: "from",
        });
        await ctx.db.patch("pipes", frozenId, { deletionJobId });
        return {
          userId,
          frozenId,
          destinationId,
          transactionId,
          deletionJobId,
        };
      });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "salary",
          value: 140,
          date: 100,
        },
      ),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      destination: await ctx.db.get("pipes", destinationId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.destination).toMatchObject({ fed: 340, spent: 0 });
    expect(state.transaction).toMatchObject({ value: 140, editedAt: expect.any(Number) });
    expect(state.corrections).toEqual([
      expect.objectContaining({
        transactionId,
        previous: { title: "salary", value: 100, date: 100 },
        current: { title: "salary", value: 140, date: 100 },
      }),
    ]);
  });

  it("allows a transfer edit across two roots while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const {
      userId,
      frozenId,
      sourceId,
      destinationId,
      transactionId,
      deletionJobId,
    } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const frozenId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        name: "Source",
        icon: "wallet-outline",
        priority: 1,
        capacity: 500,
        fed: 260,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId,
        name: "Destination",
        icon: "bank",
        priority: 2,
        capacity: 500,
        fed: 340,
        spent: 0,
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "move money",
        kind: "transfer",
        value: -40,
        date: 100,
        from: sourceId,
        to: destinationId,
      });
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozenId],
        initialBalance: 50,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", frozenId, { deletionJobId });
      return {
        userId,
        frozenId,
        sourceId,
        destinationId,
        transactionId,
        deletionJobId,
      };
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "move money",
          value: -80,
          date: 100,
        },
      ),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.source).toMatchObject({ fed: 220, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 380, spent: 0 });
    expect((state.source?.fed ?? 0) + (state.destination?.fed ?? 0)).toBe(600);
    expect(state.transaction).toMatchObject({
      value: -80,
      editedAt: expect.any(Number),
    });
    expect(state.corrections).toEqual([
      expect.objectContaining({
        transactionId,
        previous: { title: "move money", value: -40, date: 100 },
        current: { title: "move money", value: -80, date: 100 },
      }),
    ]);
  });

  it("allows a pay-by-transfer edit across two roots while an unrelated root is frozen", async () => {
    const t = convexTest(schema, modules);
    const {
      userId,
      frozenId,
      logicalId,
      payerId,
      transactionId,
      deletionJobId,
    } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const frozenId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const logicalId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 1,
        capacity: 500,
        fed: 300,
        spent: 65,
        pendingFedAdjustment: 40,
      });
      const payerId = await ctx.db.insert("pipes", {
        userId,
        name: "Bank",
        icon: "bank",
        priority: 2,
        capacity: 500,
        fed: 260,
        spent: 0,
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "coffee",
        kind: "expense",
        value: -40,
        date: 100,
        from: logicalId,
        paidFrom: payerId,
      });
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozenId],
        initialBalance: 50,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", frozenId, { deletionJobId });
      return {
        userId,
        frozenId,
        logicalId,
        payerId,
        transactionId,
        deletionJobId,
      };
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "coffee",
          value: -80,
          date: 100,
        },
      ),
    ).resolves.toMatchObject({ id: expect.anything() });

    const state = await t.run(async (ctx) => ({
      frozen: await ctx.db.get("pipes", frozenId),
      logical: await ctx.db.get("pipes", logicalId),
      payer: await ctx.db.get("pipes", payerId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.frozen?.deletionJobId).toBe(deletionJobId);
    expect(state.logical).toMatchObject({
      fed: 300,
      spent: 105,
      pendingFedAdjustment: 80,
    });
    expect(state.payer).toMatchObject({ fed: 220, spent: 0 });
    expect(state.transaction).toMatchObject({
      value: -80,
      editedAt: expect.any(Number),
    });
    expect(state.corrections).toEqual([
      expect.objectContaining({
        transactionId,
        previous: { title: "coffee", value: -40, date: 100 },
        current: { title: "coffee", value: -80, date: 100 },
      }),
    ]);
  });

  it("rejects editing a transaction in a frozen deletion subtree", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId, transactionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Frozen",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "old",
        kind: "expense",
        value: -10,
        date: 100,
        from: pipeId,
      });
      return { userId, pipeId, transactionId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await asUser.mutation(api.pipes.startPipeDeletion, {
      pipeId,
      deleteTransactions: false,
    });

    await expect(
      asUser.mutation(api.transactions.editTransaction, {
        transactionId,
        title: "new",
        value: -10,
        date: 200,
      }),
    ).rejects.toThrow("Pipe is being deleted");
  });

  it("rejects editing a transaction that references another user's pipe", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId, transactionId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash-a",
      });
      const otherUserId = await ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash-b",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 100,
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "expense",
        kind: "expense",
        value: -100,
        date: 100,
        from: pipeId,
      });
      return { userId, pipeId, transactionId };
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "changed",
          value: -200,
          date: 200,
        },
      ),
    ).rejects.toMatchObject({ data: { code: "TRANSACTION_PIPE_NOT_FOUND" } });

    const state = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", pipeId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.pipe).toMatchObject({ fed: 500, spent: 100 });
    expect(state.transaction).toMatchObject({
      title: "expense",
      value: -100,
      date: 100,
    });
    expect(state.corrections).toEqual([]);
  });

  it("rejects editing a transfer whose destination is in the source tree", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId, transactionId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          name: "Root",
          icon: "bank",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        const sourceId = await ctx.db.insert("pipes", {
          userId,
          parentId: destinationId,
          name: "Leaf",
          icon: "wallet-outline",
          priority: 0,
          capacity: 500,
          fed: 300,
          spent: 0,
        });
        const transactionId = await ctx.db.insert("transactions", {
          userId,
          title: "legacy transfer",
          kind: "transfer",
          value: -100,
          date: 100,
          from: sourceId,
          to: destinationId,
        });
        return { userId, sourceId, destinationId, transactionId };
      },
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "legacy transfer",
          value: -200,
          date: 100,
        },
      ),
    ).rejects.toMatchObject({ data: { code: "TRANSFER_SAME_TREE" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 300, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transaction).toMatchObject({ value: -100, date: 100 });
    expect(state.corrections).toEqual([]);
  });

  it("rejects editing a transfer whose destination is not a root", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId, transactionId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const sourceId = await ctx.db.insert("pipes", {
          userId,
          name: "Source",
          icon: "wallet-outline",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        const otherRootId = await ctx.db.insert("pipes", {
          userId,
          name: "Other root",
          icon: "bank",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          parentId: otherRootId,
          name: "Nested destination",
          icon: "cash",
          priority: 0,
          capacity: 500,
          fed: 200,
          spent: 0,
        });
        const transactionId = await ctx.db.insert("transactions", {
          userId,
          title: "legacy transfer",
          kind: "transfer",
          value: -100,
          date: 100,
          from: sourceId,
          to: destinationId,
        });
        return { userId, sourceId, destinationId, transactionId };
      },
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "legacy transfer",
          value: -200,
          date: 100,
        },
      ),
    ).rejects.toMatchObject({
      data: { code: "TRANSFER_DESTINATION_NOT_ROOT" },
    });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 500, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 200, spent: 0 });
    expect(state.transaction).toMatchObject({ value: -100, date: 100 });
    expect(state.corrections).toEqual([]);
  });

  it("rejects editing a transfer whose source has children", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId, transactionId } = await t.run(
      async (ctx) => {
        const userId = await ctx.db.insert("users", {
          username: "alice",
          email: "alice@example.com",
          password: "hash",
        });
        const sourceId = await ctx.db.insert("pipes", {
          userId,
          name: "Source",
          icon: "wallet-outline",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        await ctx.db.insert("pipes", {
          userId,
          parentId: sourceId,
          name: "Child",
          icon: "cash",
          priority: 0,
          capacity: 500,
          fed: 100,
          spent: 0,
        });
        const destinationId = await ctx.db.insert("pipes", {
          userId,
          name: "Destination",
          icon: "bank",
          priority: 0,
          capacity: 1000,
          fed: 200,
          spent: 0,
        });
        const transactionId = await ctx.db.insert("transactions", {
          userId,
          title: "legacy transfer",
          kind: "transfer",
          value: -100,
          date: 100,
          from: sourceId,
          to: destinationId,
        });
        return { userId, sourceId, destinationId, transactionId };
      },
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(
        api.transactions.editTransaction,
        {
          transactionId,
          title: "legacy transfer",
          value: -200,
          date: 100,
        },
      ),
    ).rejects.toMatchObject({ data: { code: "TRANSFER_SOURCE_NOT_LEAF" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transaction: await ctx.db.get("transactions", transactionId),
      corrections: await ctx.db.query("transactionCorrections").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 500, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 200, spent: 0 });
    expect(state.transaction).toMatchObject({ value: -100, date: 100 });
    expect(state.corrections).toEqual([]);
  });
});
