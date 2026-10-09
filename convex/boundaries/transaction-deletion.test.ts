// @vitest-environment edge-runtime
import { insertOperation, readOperation } from "./financialFixtures.helpers";
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: name,
        value,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      return { userId, pipeId, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
    );

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.pipeId),
      transaction: await readOperation(ctx, state.operationId),
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "feed",
        value: 500,
        date: 1000,
        kind: "feed",
        to: pipeId,
      });
      return { userId, pipeId, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from,
        to,
      });
      return { userId, from, to, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "purchase",
        value: -500,
        date: 1000,
        kind: "expense",
        from,
        paidFrom,
      });
      return { userId, from, paidFrom, operationId };
    });

    const client = t.withIdentity({ subject: state.userId });
    await client.mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "old transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from: missing,
        to: surviving,
      });
      return { userId, surviving, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
    );

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.surviving),
      transaction: await readOperation(ctx, state.operationId),
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "legacy purchase",
        value: -500,
        date: 1000,
        kind: "expense",
        from,
        paidFrom,
      });
      return { userId, from, paidFrom, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
    );

    const [from, paidFrom, transaction] = await t.run(async (ctx) => Promise.all([
      ctx.db.get("pipes", state.from),
      ctx.db.get("pipes", state.paidFrom),
      readOperation(ctx, state.operationId),
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "old transfer",
        value: -500,
        date: 1000,
        kind: "transfer",
        from: missing,
        to: surviving,
      });
      return { userId, operationId };
    });

    await expect(t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
    )).rejects.toThrow("Pipe is being deleted");
    expect(await t.run((ctx) =>
      readOperation(ctx, state.operationId)
    )).not.toBeNull();
  });

  it("cleans correction history in bounded scheduled batches", async () => {
    const t = convexTest(schema, modules);
    const state = await t.run(async (ctx) => {
      const userId = await seedUser(ctx);
      const pipeId = await seedPipe(ctx, userId, { spent: 100 });
      const operationId = await insertOperation(ctx, {
        userId,
        title: "edited expense",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      for (let index = 0; index < 101; index += 1) {
        await ctx.db.insert("transactionCorrections", {
          operationId,
          userId,
          editedAt: index,
          previous: { title: "old", value: -100, date: 1000 },
          current: { title: "new", value: -100, date: 1000 },
        });
      }
      return { userId, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "old expense",
        value: -500,
        date: 1000,
        kind: "expense",
        from: source,
      });
      return { userId, source, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "expense",
        value: -500,
        date: 1000,
        kind: "expense",
        from: source,
      });
      return { userId, source, operationId };
    });

    await expect(t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
    )).rejects.toThrow("Pipe is being deleted");

    const result = await t.run(async (ctx) => ({
      pipe: await ctx.db.get("pipes", state.source),
      transaction: await readOperation(ctx, state.operationId),
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
      const operationId = await insertOperation(ctx, {
        userId,
        title: "refund",
        value: 500,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      return { userId, pipeId, operationId };
    });

    await t.withIdentity({ subject: state.userId }).mutation(
      api.financialOperations.remove,
      { operationId: state.operationId },
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
      const foreignTransactionId = await insertOperation(ctx, {
        userId: ownerId,
        title: "private",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      const missingTransactionId = await insertOperation(ctx, {
        userId: ownerId,
        title: "removed",
        value: -100,
        date: 1000,
        kind: "expense",
        from: pipeId,
      });
      await ctx.db.delete("events", missingTransactionId);
      return { requesterId, foreignTransactionId, missingTransactionId };
    });
    const client = t.withIdentity({ subject: state.requesterId });

    await expect(client.mutation(api.financialOperations.remove, {
      operationId: state.foreignTransactionId,
    })).rejects.toThrow("OPERATION_NOT_FOUND");
    await expect(client.mutation(api.financialOperations.remove, {
      operationId: state.missingTransactionId,
    })).rejects.toThrow("OPERATION_NOT_FOUND");
  });
});
