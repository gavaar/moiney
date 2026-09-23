// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function seedUser(ctx: any, username = "alice") {
  return await ctx.db.insert("users", {
    username,
    email: `${username}@example.com`,
    password: "hash",
  });
}

async function seedPipe(
  ctx: any,
  userId: any,
  values: Record<string, unknown> = {},
) {
  return await ctx.db.insert("pipes", {
    userId,
    name: "Pipe",
    icon: "wallet",
    priority: 0,
    capacity: 2000,
    fed: 1000,
    spent: 0,
    ...values,
  });
}

describe("transaction deletion", () => {
  it.each([
    {
      name: "expense",
      value: -500,
      startingSpent: 500,
      expectedSpent: 0,
    },
    {
      name: "refund",
      value: 200,
      startingSpent: 300,
      expectedSpent: 500,
    },
  ])("reverses an ordinary $name", async ({ name, value, startingSpent, expectedSpent }) => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const pipeId = await seedPipe(ctx, userId, { spent: startingSpent });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: name,
        value,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      return { userId, pipeId, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.pipeId),
      transaction: await ctx.db.get("transactions", state.transactionId),
    }));
    expect(result.pipe?.spent).toBe(expectedSpent);
    expect(result.transaction).toBeNull();
  });

  it("reverses a feed and boiler principal", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const pipeId = await seedPipe(ctx, userId, {
        sourceType: "boiler",
        contributedFed: 1500,
        fed: 1500,
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "feed",
        value: 500,
        date: 1000,
        kind: "feed",
        to: pipeId,
      });
      return { userId, pipeId, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    expect(await t.run((ctx) => ctx.db.get("pipes", state.pipeId))).toMatchObject({
      fed: 1000,
      contributedFed: 1000,
    });
  });

  it("reverses both sides of a transfer", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const from = await seedPipe(ctx, userId, { fed: 500 });
      const to = await seedPipe(ctx, userId, { fed: 1500 });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from,
        to,
      });
      return { userId, from, to, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    const [from, to] = await t.run(async (ctx) => Promise.all([
      ctx.db.get("pipes", state.from),
      ctx.db.get("pipes", state.to),
    ]));
    expect(from?.fed).toBe(1000);
    expect(to?.fed).toBe(1000);
  });

  it("reverses logical spending, pending adjustment, and payer liquidity", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const from = await seedPipe(ctx, userId, {
        spent: 500,
        pendingFedAdjustment: 500,
      });
      const paidFrom = await seedPipe(ctx, userId, { fed: 500 });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "purchase",
        value: -500,
        date: 1000,
        kind: "expense",
        from,
        paidFrom,
      });
      return { userId, from, paidFrom, transactionId };
    });

    const client = t.withIdentity({ subject: state.userId });
    const history = await client.query(api.history.list, {
      source: "transactions",
      limit: 10,
    });
    expect(history.items[0]).toMatchObject({
      kind: "transaction",
      transaction: {
        id: state.transactionId,
      },
    });

    await client.mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    const [from, paidFrom] = await t.run(async (ctx) => Promise.all([
      ctx.db.get("pipes", state.from),
      ctx.db.get("pipes", state.paidFrom),
    ]));
    expect(from).toMatchObject({ spent: 0, pendingFedAdjustment: 0 });
    expect(paidFrom?.fed).toBe(1000);
  });

  it("deletes history without changing surviving pipes when any role is missing", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const missing = await seedPipe(ctx, userId);
      const surviving = await seedPipe(ctx, userId, { fed: 1500 });
      await ctx.db.delete("pipes", missing);
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "old transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from: missing,
        to: surviving,
        fromIcon: "wallet",
      });
      return { userId, surviving, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.surviving),
      transaction: await ctx.db.get("transactions", state.transactionId),
    }));
    expect(result.pipe?.fed).toBe(1500);
    expect(result.transaction).toBeNull();
  });

  it("reverses pay-by-transfer accounting without persisted version metadata", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const from = await seedPipe(ctx, userId, {
        spent: 500,
        pendingFedAdjustment: 200,
      });
      const paidFrom = await seedPipe(ctx, userId, { fed: 500 });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "legacy purchase",
        value: -500,
        date: 1000,
        kind: "expense",
        from,
        paidFrom,
      });
      return { userId, from, paidFrom, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    const [from, paidFrom, transaction] = await t.run(async (ctx) => Promise.all([
      ctx.db.get("pipes", state.from),
      ctx.db.get("pipes", state.paidFrom),
      ctx.db.get("transactions", state.transactionId),
    ]));
    expect(from).toMatchObject({ spent: 0, pendingFedAdjustment: -300 });
    expect(paidFrom?.fed).toBe(1000);
    expect(transaction).toBeNull();
  });

  it("blocks history-only deletion while a surviving involved tree is frozen", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const missing = await seedPipe(ctx, userId);
      const surviving = await seedPipe(ctx, userId);
      const frozenSibling = await seedPipe(ctx, userId, { parentId: surviving });
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozenSibling],
        initialBalance: 0,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", frozenSibling, { deletionJobId });
      await ctx.db.delete("pipes", missing);
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "old transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from: missing,
        to: surviving,
        fromIcon: "wallet",
      });
      return { userId, transactionId };
    });

    await expect(t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    )).rejects.toThrow("Pipe is being deleted");
    expect(await t.run((ctx) =>
      ctx.db.get("transactions", state.transactionId)
    )).not.toBeNull();
  });

  it("cleans correction history in bounded scheduled batches", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const pipeId = await seedPipe(ctx, userId, { spent: 100 });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "edited expense",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("transactionCorrections", {
          transactionId,
          userId,
          editedAt: index,
          previous: { title: "old", value: -100, date: 1000 },
          current: { title: "new", value: -100, date: 1000 },
        });
      }
      return { userId, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );
    vi.useFakeTimers();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.useRealTimers();

    expect(await t.run((ctx) =>
      ctx.db.query("transactionCorrections").collect()
    )).toEqual([]);
  });

  it("does not require the original source to remain a leaf", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const source = await seedPipe(ctx, userId, { spent: 500 });
      await seedPipe(ctx, userId, { parentId: source, fed: 0 });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "old expense",
        value: -500,
        date: 1000,
        kind: "expense",
        from: source,
      });
      return { userId, source, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    expect(await t.run((ctx) => ctx.db.get("pipes", state.source))).toMatchObject({
      spent: 0,
    });
  });

  it("rejects rollback when a sibling in an affected tree is frozen", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const root = await seedPipe(ctx, userId);
      const source = await seedPipe(ctx, userId, { parentId: root, spent: 500 });
      const sibling = await seedPipe(ctx, userId, { parentId: root });
      const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [sibling],
        initialBalance: 0,
        phase: "processingTransactions",
        memberIndex: 0,
        role: "from",
      });
      await ctx.db.patch("pipes", sibling, { deletionJobId });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "expense",
        value: -500,
        date: 1000,
        kind: "expense",
        from: source,
      });
      return { userId, source, transactionId };
    });

    await expect(t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    )).rejects.toThrow("Pipe is being deleted");

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.source),
      transaction: await ctx.db.get("transactions", state.transactionId),
    }));
    expect(result.pipe?.spent).toBe(500);
    expect(result.transaction).not.toBeNull();
  });

  it("runs instant settlement when deleting a refund adds spending", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const pipeId = await seedPipe(ctx, userId, {
        fed: 1000,
        spent: 0,
        rule: "instant_settlement",
      });
      const transactionId = await ctx.db.insert("transactions", {
        userId,
        title: "refund",
        value: 500,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      return { userId, pipeId, transactionId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.deleteTransaction,
      { transactionId: state.transactionId },
    );

    expect(await t.run((ctx) => ctx.db.get("pipes", state.pipeId))).toMatchObject({
      fed: 500,
      spent: 0,
    });
  });

  it("does not disclose whether a transaction is missing or foreign", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const ownerId = await seedUser(ctx, "owner");
      const requesterId = await seedUser(ctx, "requester");
      const pipeId = await seedPipe(ctx, ownerId);
      const foreignTransactionId = await ctx.db.insert("transactions", {
        userId: ownerId,
        title: "private",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      const missingTransactionId = await ctx.db.insert("transactions", {
        userId: ownerId,
        title: "removed",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      await ctx.db.delete("transactions", missingTransactionId);
      return { requesterId, foreignTransactionId, missingTransactionId };
    });
    const client = t.withIdentity({ subject: state.requesterId });

    await expect(client.mutation(api.transactions.deleteTransaction, {
      transactionId: state.foreignTransactionId,
    })).rejects.toThrow("TRANSACTION_NOT_FOUND");
    await expect(client.mutation(api.transactions.deleteTransaction, {
      transactionId: state.missingTransactionId,
    })).rejects.toThrow("TRANSACTION_NOT_FOUND");
  });
});
