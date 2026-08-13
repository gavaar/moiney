// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules } from "./test.setup";

describe("Convex boundaries", () => {
  it("clears a pipe description through the registered mutation contract", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Groceries",
        icon: "cart",
        description: "Old description",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      return { userId, pipeId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.pipes.updatePipe, {
      pipeId,
      description: null,
    });

    const pipe = await t.run((ctx) => ctx.db.get("pipes", pipeId));
    expect(pipe).not.toHaveProperty("description");
  });

  it("rejects creating a pipe beneath another user's parent without writes", async () => {
    const t = convexTest(schema, modules);
    const { userA, parentId } = await t.run(async (ctx) => {
      const userA = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash-a",
      });
      const userB = await ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash-b",
      });
      const parentId = await ctx.db.insert("pipes", {
        userId: userB,
        name: "Bob's pipe",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 10,
      });
      return { userA, parentId };
    });
    const asUserA = t.withIdentity({ subject: userA });

    await expect(
      asUserA.mutation(api.pipes.addPipe, {
        name: "Unauthorized child",
        icon: "pipe",
        priority: 1,
        capacity: 25,
        parentId,
      }),
    ).rejects.toThrow("Parent pipe not found");

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes).toHaveLength(1);
    expect(pipes[0]).toMatchObject({
      _id: parentId,
      capacity: 100,
      fed: 50,
      spent: 10,
    });
  });

  it("atomically registers one canonical account and linked session", async () => {
    const t = convexTest(schema, modules);
    const args = {
      username: " ALICE ",
      email: "alice@example.com",
      password: "password-hash",
      familyId: "family-1",
      refreshTokenHash: "refresh-hash-1",
      expiresAt: Date.now() + 60_000,
    };

    const result = await t.mutation(
      internal.accounts.registerWithSession,
      args,
    );

    const stateAfterRegistration = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      sessions: await ctx.db.query("sessions").collect(),
    }));
    expect(stateAfterRegistration.users).toHaveLength(1);
    expect(stateAfterRegistration.users[0]).toMatchObject({
      _id: result.userId,
      username: "alice",
    });
    expect(stateAfterRegistration.sessions).toHaveLength(1);
    expect(stateAfterRegistration.sessions[0]).toMatchObject({
      _id: result.sessionId,
      userId: result.userId,
      familyId: "family-1",
      active: true,
    });

    await expect(
      t.mutation(internal.accounts.registerWithSession, {
        ...args,
        username: "alice",
        familyId: "family-2",
        refreshTokenHash: "refresh-hash-2",
      }),
    ).rejects.toThrow("Account already exists");

    const stateAfterDuplicate = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      sessions: await ctx.db.query("sessions").collect(),
    }));
    expect(stateAfterDuplicate.users).toHaveLength(1);
    expect(stateAfterDuplicate.sessions).toHaveLength(1);
  });

  it("filters transactions through from, to, and paidFrom involvement", async () => {
    const t = convexTest(schema, modules);
    const { userId, selectedPipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const selectedPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Selected",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      const otherPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Other",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 0,
        spent: 0,
      });
      const rows = [
        { title: "from", kind: "expense" as const, from: selectedPipeId },
        { title: "to", kind: "feed" as const, to: selectedPipeId },
        { title: "paid", kind: "expense" as const, from: otherPipeId, paidFrom: selectedPipeId },
        { title: "unrelated", kind: "expense" as const, from: otherPipeId },
      ];
      for (const [index, row] of rows.entries()) {
        await ctx.db.insert("transactions", {
          ...row,
          userId,
          value: -1,
          date: index,
        });
      }
      return { userId, selectedPipeId };
    });

    const transactions = await t
      .withIdentity({ subject: userId })
      .query(api.transactions.listTransactions, {
        pipeIds: [selectedPipeId],
      });

    expect(transactions.map((transaction: { title: string }) => transaction.title).sort()).toEqual(
      ["from", "paid", "to"],
    );
  });

  it("returns only the authenticated user's profile without credentials", async () => {
    const t = convexTest(schema, modules);
    const aliceId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash-a",
      }),
    );
    await t.run(async (ctx) =>
      ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash-b",
      }),
    );

    const profile = await t
      .withIdentity({ subject: aliceId })
      .query(api.profile.getMyProfile);

    expect(profile).toEqual({ username: "alice", pictureUrl: null });
    expect(profile).not.toHaveProperty("email");
    expect(profile).not.toHaveProperty("password");
  });

  it("loads sign-in credentials for a user with a profile picture", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await t.run(async (ctx) => {
      const picture = await ctx.storage.store(new Blob(["picture"]));
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
        picture: picture as Id<"_storage">,
      });
      return { userId };
    });

    const user = await t.query(internal.accounts.getUserByUsername, {
      username: "alice",
    });

    expect(user).toEqual({
      _id: userId,
      password: "hash",
    });
  });

  it("requires authentication to read the profile", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.profile.getMyProfile)).rejects.toThrow("Not authenticated");
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
    expect(first).toMatchObject({ jobId: state.jobs[0]._id, phase: "processingTransactions" });
    expect(state.root?.deletionJobId).toBe(first.jobId);
    expect(state.child?.deletionJobId).toBe(first.jobId);

    await expect(
      t.withIdentity({ subject: "other-user" }).query(
        api.pipes.getPipeDeletionStatus,
        { jobId: first.jobId },
      ),
    ).rejects.toThrow("Not authorized");

    await expect(
      t.withIdentity({ subject: userId }).query(api.pipes.getPipeDeletionStatus, {
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

    await t.withIdentity({ subject: userId }).mutation(api.pipes.startPipeDeletion, {
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
        { title: "expense-deleted", kind: "expense" as const, from: deletedPipeId },
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

    await t.withIdentity({ subject: userId }).mutation(api.pipes.startPipeDeletion, {
      pipeId: deletedPipeId,
      deleteTransactions: true,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const transactions = await t.run((ctx) => ctx.db.query("transactions").collect());
    expect(transactions.map((transaction) => transaction.title).sort()).toEqual([
      "pay-category-deleted",
      "pay-payer-deleted",
      "transfer-from-survivor",
      "transfer-to-survivor",
    ]);
    expect(transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: "pay-category-deleted", fromIcon: "cafe" }),
        expect.objectContaining({ title: "pay-payer-deleted", paidFromIcon: "cafe" }),
        expect.objectContaining({ title: "transfer-from-survivor", toIcon: "cafe" }),
        expect.objectContaining({ title: "transfer-to-survivor", fromIcon: "cafe" }),
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
});
