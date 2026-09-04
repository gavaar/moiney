// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import { MAX_PIPES_PER_USER } from "../lib/constants";
import schema from "../schema";
import { modules } from "../test.setup";

describe("Convex boundaries: pipes, rules, and scheduling", () => {
  it("creates a feed with its initial current value", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      }),
    );

    const pipeId = await t
      .withIdentity({ subject: userId })
      .mutation(api.pipes.addFeed, {
        name: "Income",
        icon: "wallet-outline",
        sourceType: "feed",
        initialFed: 12_550,
      });

    const pipe = await t.run((ctx) => ctx.db.get("pipes", pipeId));
    expect(pipe).toMatchObject({
      sourceType: "feed",
      capacity: 0,
      fed: 12_550,
      spent: 0,
      rule: "instant_settlement",
    });
    expect(pipe?.contributedFed).toBeUndefined();
  });

  it("rejects a negative initial feed value", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      }),
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.addFeed, {
        name: "Income",
        icon: "wallet-outline",
        sourceType: "feed",
        initialFed: -1,
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INITIAL_PIPE_VALUE" } });

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes).toHaveLength(0);
  });

  it("creates a boiler with independent current and contributed values", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      }),
    );

    const pipeId = await t
      .withIdentity({ subject: userId })
      .mutation(api.pipes.addFeed, {
        name: "Savings",
        icon: "water-boiler",
        sourceType: "boiler",
        initialFed: 15_000,
        contributedFed: 10_000,
      });

    const pipe = await t.run((ctx) => ctx.db.get("pipes", pipeId));
    expect(pipe).toMatchObject({
      sourceType: "boiler",
      contributedFed: 10_000,
      fed: 15_000,
      capacity: 0,
      spent: 0,
      rule: "instant_settlement",
    });
  });

  it("rejects a negative initial boiler contribution", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run((ctx) =>
      ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      }),
    );

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.addFeed, {
        name: "Savings",
        icon: "water-boiler",
        sourceType: "boiler",
        contributedFed: -1,
      }),
    ).rejects.toMatchObject({ data: { code: "INVALID_INITIAL_PIPE_VALUE" } });

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes).toHaveLength(0);
  });

  it("returns a structured pipe-limit error without creating a feed", async () => {
    const t = convexTest(schema, modules);
    const userId = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      for (let index = 0; index < MAX_PIPES_PER_USER; index += 1) {
        await ctx.db.insert("pipes", {
          userId,
          name: `Pipe ${index}`,
          icon: "wallet-outline",
          priority: index,
          capacity: 0,
          fed: 0,
          spent: 0,
        });
      }
      return userId;
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.addFeed, {
        name: "One too many",
        icon: "add-circle-outline",
      }),
    ).rejects.toMatchObject({ data: { code: "PIPE_LIMIT_REACHED" } });

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes).toHaveLength(MAX_PIPES_PER_USER);
    expect(pipes.some((pipe) => pipe.name === "One too many")).toBe(false);
  });

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

  it("returns the same expected error for missing and foreign pipes before updating a pipe", async () => {
    const t = convexTest(schema, modules);
    const { userId, missingPipeId, foreignPipeId } = await t.run(async (ctx) => {
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
      const missingPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Deleted",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 0,
      });
      await ctx.db.delete("pipes", missingPipeId);
      const foreignPipeId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign",
        icon: "wallet-outline",
        description: "unchanged",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 100,
      });
      await ctx.db.insert("pipes", {
        userId,
        name: "Owned",
        icon: "home-outline",
        priority: 0,
        capacity: 1000,
        fed: 250,
        spent: 25,
      });
      return { userId, missingPipeId, foreignPipeId };
    });
    const before = await t.run((ctx) => ctx.db.query("pipes").collect());
    const asUser = t.withIdentity({ subject: userId });

    for (const pipeId of [missingPipeId, foreignPipeId]) {
      await expect(
        asUser.mutation(api.pipes.updatePipe, {
          pipeId,
          name: "Changed",
          capacity: 999,
        }),
      ).rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
    }

    const after = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(after).toEqual(before);
  });

  it("returns the same expected error for missing and foreign parents before adding a pipe", async () => {
    const t = convexTest(schema, modules);
    const { userA, missingParentId, foreignParentId } = await t.run(async (ctx) => {
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
      const missingParentId = await ctx.db.insert("pipes", {
        userId: userA,
        name: "Deleted parent",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 10,
      });
      await ctx.db.delete("pipes", missingParentId);
      const foreignParentId = await ctx.db.insert("pipes", {
        userId: userB,
        name: "Bob's pipe",
        icon: "pipe",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 10,
      });
      return { userA, missingParentId, foreignParentId };
    });
    const asUserA = t.withIdentity({ subject: userA });
    const before = await t.run((ctx) => ctx.db.query("pipes").collect());

    for (const parentId of [missingParentId, foreignParentId]) {
      await expect(
        asUserA.mutation(api.pipes.addPipe, {
          name: "Unauthorized child",
          icon: "pipe",
          priority: 1,
          capacity: 25,
          parentId,
        }),
      ).rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
    }

    const after = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(after).toEqual(before);
  });

  it("settles pending accounting before converting a leaf into a parent", async () => {
    const t = convexTest(schema, modules);
    const { userId, parentId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const parentId = await ctx.db.insert("pipes", {
        userId,
        name: "Household",
        icon: "home-outline",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 300,
        pendingFedAdjustment: 300,
      });
      return { userId, parentId };
    });

    const childId = await t.withIdentity({ subject: userId }).mutation(api.pipes.addPipe, {
      name: "Coffee",
      icon: "cafe",
      priority: 0,
      capacity: 400,
      parentId,
    });

    const pipes = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});
    const rawParent = await t.run((ctx) => ctx.db.get("pipes", parentId));
    const parent = pipes.find((pipe) => pipe._id === parentId);
    const child = pipes.find((pipe) => pipe._id === childId);

    expect(parent).toMatchObject({
      fed: 1000,
      spent: 0,
      pendingFedAdjustment: 0,
    });
    expect(child).toMatchObject({ fed: 400 });
    expect(rawParent).toMatchObject({ fed: 600, spent: 0, pendingFedAdjustment: 0 });
    expect((rawParent?.fed ?? 0) + (child?.fed ?? 0)).toBe(1000);
  });

  it("returns the same expected error for missing and foreign pipes before updating a pipe rule", async () => {
    const t = convexTest(schema, modules);
    const { userId, missingPipeId, foreignPipeId } = await t.run(async (ctx) => {
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
      const missingPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Deleted",
        icon: "trash-outline",
        priority: 0,
        capacity: 100,
        fed: 50,
        spent: 10,
      });
      await ctx.db.delete("pipes", missingPipeId);
      const foreignPipeId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 100,
        rule: "spend_overflow",
      });
      await ctx.db.insert("pipes", {
        userId,
        name: "Owned",
        icon: "home-outline",
        priority: 0,
        capacity: 500,
        fed: 250,
        spent: 25,
      });
      return { userId, missingPipeId, foreignPipeId };
    });
    const before = await t.run((ctx) => ctx.db.query("pipes").collect());
    const asUser = t.withIdentity({ subject: userId });

    for (const pipeId of [missingPipeId, foreignPipeId]) {
      await expect(
        asUser.mutation(api.pipes.updatePipeRule, {
          pipeId,
          rule: "instant_settlement",
          capUpdateValue: 25,
        }),
      ).rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
    }

    const after = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(after).toEqual(before);
  });

  it("continues through the mutable cron index after processing and skipping a blocked candidate", async () => {
    const t = convexTest(schema, modules);
    const now = Date.UTC(2026, 5, 15, 13);
    const nextDate = Date.UTC(2026, 5, 15, 5);
    const { firstId, frozenId, lastId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const lastUserId = await ctx.db.insert("users", {
        username: "bob",
        email: "bob@example.com",
        password: "hash",
      });
      const makeCronPipe = (
        ownerId: typeof userId,
        name: string,
        date = nextDate,
      ) =>
        ctx.db.insert("pipes", {
          userId: ownerId,
          name,
          icon: "clock-outline",
          priority: 0,
          capacity: 500,
          fed: 100,
          spent: 20,
          rule: "cron" as const,
          cronNextDate: date,
          cronInterval: { interval: 1, unit: "days" as const },
        });
      const firstId = await makeCronPipe(userId, "First");
      const frozenId = await makeCronPipe(userId, "Frozen");
      for (let index = 0; index < 498; index += 1) {
        await makeCronPipe(userId, `Filler ${index}`);
      }
      const lastId = await makeCronPipe(lastUserId, "Last", nextDate + 1);
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozenId],
        initialBalance: 80,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", frozenId, { deletionJobId });
      return { firstId, frozenId, lastId };
    });

    await t.mutation(internal.pipes.runDueCronRules, { now });

    const afterFirstPage = await t.run(async (ctx) => ({
      first: await ctx.db.get("pipes", firstId),
      frozen: await ctx.db.get("pipes", frozenId),
      last: await ctx.db.get("pipes", lastId),
    }));
    expect(afterFirstPage.first?.cronNextDate).toBe(
      Date.UTC(2026, 5, 16, 5),
    );
    expect(afterFirstPage.frozen?.cronNextDate).toBe(nextDate);
    expect(afterFirstPage.last?.cronNextDate).toBe(nextDate + 1);

    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    const afterContinuation = await t.run(async (ctx) => ({
      first: await ctx.db.get("pipes", firstId),
      frozen: await ctx.db.get("pipes", frozenId),
      last: await ctx.db.get("pipes", lastId),
    }));
    expect(afterContinuation.first?.cronNextDate).toBe(
      Date.UTC(2026, 5, 16, 5),
    );
    expect(afterContinuation.frozen?.cronNextDate).toBe(nextDate);
    expect(afterContinuation.last?.cronNextDate).toBe(
      Date.UTC(2026, 5, 16, 5),
    );
  });

  it("rejects the removed any_spend rule identifier after migration", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
        rule: "instant_settlement",
      });
      return { userId, pipeId };
    });

    await expect(
      t.withIdentity({ subject: userId }).mutation(api.pipes.updatePipeRule, {
        pipeId,
        rule: "any_spend" as any,
      }),
    ).rejects.toThrow();
  });

  it("settles an ordinary refund through instant settlement", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 500,
        rule: "instant_settlement",
      });
      return { userId, pipeId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.transactions.createTransaction, {
      title: "coffee refund",
      value: 250,
      date: 3000,
      from: pipeId,
    });

    const [pipe] = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});
    expect(pipe).toMatchObject({ fed: 750, spent: 0, pendingFedAdjustment: 0 });
  });

  it("settles a pay-by refund through instant settlement", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId, bankId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const coffeeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 500,
        rule: "instant_settlement",
      });
      const bankId = await ctx.db.insert("pipes", {
        userId,
        name: "Bank",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      return { userId, coffeeId, bankId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.transactions.createTransaction, {
      title: "coffee refund",
      value: 250,
      date: 3000,
      from: coffeeId,
      paidFrom: bankId,
    });

    const pipes = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});
    const coffee = pipes.find((pipe) => pipe._id === coffeeId);
    const bank = pipes.find((pipe) => pipe._id === bankId);
    expect(coffee).toMatchObject({ fed: 500, spent: 0, pendingFedAdjustment: 0 });
    expect(bank).toMatchObject({ fed: 1250 });
  });

  it("settles a paid-by expense through the logical pipe's any-spend rule", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId, bankId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const coffeeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
        rule: "instant_settlement",
        capUpdateValue: 100,
      });
      const bankId = await ctx.db.insert("pipes", {
        userId,
        name: "Bank",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      return { userId, coffeeId, bankId };
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.transactions.createTransaction, {
        title: "coffee",
        value: -300,
        date: 3000,
        from: coffeeId,
        paidFrom: bankId,
      });

    const pipes = await t
      .withIdentity({ subject: userId })
      .query(api.pipes.getPipes, {});
    const coffee = pipes.find((pipe) => pipe._id === coffeeId);
    const bank = pipes.find((pipe) => pipe._id === bankId);

    expect(coffee).toMatchObject({
      fed: 1000,
      spent: 0,
      pendingFedAdjustment: 0,
      capacity: 800,
    });
    expect(bank).toMatchObject({ fed: 700 });
  });

  it("settles pending external liquidity adjustments with the logical pipe's spending", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const coffeeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 250,
        pendingFedAdjustment: -250,
      });
      return { userId, coffeeId };
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.pipes.executePipeRuleNow, {
        pipeId: coffeeId,
      });

    const pipes = await t
      .withIdentity({ subject: userId })
      .query(api.pipes.getPipes, {});
    expect(pipes[0]).toMatchObject({
      fed: 500,
      spent: 0,
      pendingFedAdjustment: 0,
    });
  });

  it("returns the same expected error for missing and foreign pipes before manual rule execution", async () => {
    const t = convexTest(schema, modules);
    const { userId, missingPipeId, foreignPipeId } = await t.run(async (ctx) => {
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
      const missingPipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Deleted",
        icon: "trash-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 100,
      });
      await ctx.db.delete("pipes", missingPipeId);
      const foreignPipeId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 100,
        pendingFedAdjustment: 25,
      });
      return { userId, missingPipeId, foreignPipeId };
    });
    const asUser = t.withIdentity({ subject: userId });

    for (const pipeId of [missingPipeId, foreignPipeId]) {
      await expect(
        asUser.mutation(api.pipes.executePipeRuleNow, { pipeId }),
      ).rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
    }

    const foreignPipe = await t.run((ctx) =>
      ctx.db.get("pipes", foreignPipeId),
    );
    expect(foreignPipe).toMatchObject({
      capacity: 1000,
      fed: 500,
      spent: 100,
      pendingFedAdjustment: 25,
    });
  });

  it("settles a legacy pipe with omitted pending adjustment from stored fed and spent", async () => {
    const t = convexTest(schema, modules);
    const { userId, pipeId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 300,
        rule: "instant_settlement",
      });
      return { userId, pipeId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.pipes.executePipeRuleNow, {
      pipeId,
    });

    const rawPipe = await t.run((ctx) => ctx.db.get("pipes", pipeId));
    const [pipe] = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});

    expect(rawPipe).toMatchObject({ fed: 700, spent: 0 });
    expect(rawPipe).not.toHaveProperty("pendingFedAdjustment");
    expect(pipe).toMatchObject({ fed: 700, spent: 0, pendingFedAdjustment: 0 });
  });

  it("aggregates pending external adjustments through a pipe tree", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId, rootId, bankId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const rootId = await ctx.db.insert("pipes", {
        userId,
        name: "Household",
        icon: "home-outline",
        priority: 0,
        capacity: 1000,
        fed: 0,
        spent: 0,
      });
      const coffeeId = await ctx.db.insert("pipes", {
        userId,
        name: "Coffee",
        icon: "cafe",
        parentId: rootId,
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 500,
      });
      const bankId = await ctx.db.insert("pipes", {
        userId,
        name: "Bank",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      return { userId, coffeeId, rootId, bankId };
    });

    await t
      .withIdentity({ subject: userId })
      .mutation(api.transactions.createTransaction, {
        title: "coffee refund",
        value: 250,
        date: 3000,
        from: coffeeId,
        paidFrom: bankId,
      });

    const pipes = await t
      .withIdentity({ subject: userId })
      .query(api.pipes.getPipes, {});
    const household = pipes.find((pipe) => pipe._id === rootId);

    expect(household).toMatchObject({
      spent: 250,
      pendingFedAdjustment: -250,
    });
  });
});
