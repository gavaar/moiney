// @vitest-environment edge-runtime
import { contributeAndReadOperation, readOperations, createAndReadOperation, insertOperation } from "./financialFixtures.helpers";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { MAX_AMOUNT } from "../../domain/money";
import { insertFinancialOperation } from "../lib/events/financial";

describe("Convex boundaries: transactions, transfers, and history", () => {
  it("adds a boiler contribution to principal and current fed", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 10000,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 10000,
      });
      return { userId, boilerId };
    });

    const transaction = await contributeAndReadOperation(t, t
      .withIdentity({ subject: userId }), {
        pipeId: boilerId,
        title: "Investment",
        value: 30000,
        date: 3000,
      });

    const boiler = await t.run((ctx) => ctx.db.get("pipes", boilerId));
    expect(boiler).toMatchObject({ fed: 40000, contributedFed: 40000 });
    expect(transaction).toMatchObject({
      title: "investment",
      value: 30000,
      kind: "feed",
      to: boilerId,
    });
  });

  it("corrects boiler current fed without changing principal or history", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 10000,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 10000,
      });
      return { userId, boilerId };
    });

    const transaction = await contributeAndReadOperation(t, t
      .withIdentity({ subject: userId }), {
        pipeId: boilerId,
        title: "Correction",
        value: 0,
        currentFed: -5000,
        date: 3000,
      });

    const state = await t.run(async (ctx) => ({
      boiler: await ctx.db.get("pipes", boilerId),
      transactions: await readOperations(ctx),
    }));
    expect(state.boiler).toMatchObject({
      fed: -5000,
      contributedFed: 10000,
    });
    expect(state.transactions).toEqual([]);
    expect(transaction).toBeNull();
  });

  it("sets manually modified boiler current fed while adding principal", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 10000,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 10000,
      });
      return { userId, boilerId };
    });

    await contributeAndReadOperation(t, t.withIdentity({ subject: userId }), {
        pipeId: boilerId,
        title: "Investment",
        value: 30000,
        currentFed: 5000,
        date: 3000,
      });

    const boiler = await t.run((ctx) => ctx.db.get("pipes", boilerId));
    expect(boiler).toMatchObject({ fed: 5000, contributedFed: 40000 });
  });

  it("corrects the aggregate current fed of a boiler with children", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 1000,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 10000,
      });
      await ctx.db.insert("pipes", {
        userId,
        parentId: boilerId,
        name: "Reserve",
        icon: "wallet-outline",
        priority: 0,
        capacity: 10000,
        fed: 9000,
        spent: 0,
      });
      return { userId, boilerId };
    });

    await contributeAndReadOperation(t, t.withIdentity({ subject: userId }), {
        pipeId: boilerId,
        title: "Correction",
        value: 0,
        currentFed: 5000,
        date: 3000,
      });

    const pipes = await t.run((ctx) => ctx.db.query("pipes").collect());
    expect(pipes.reduce((total, pipe) => total + pipe.fed, 0)).toBe(5000);
  });

  it("rejects an aggregate correction that would overflow root-local fed", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 0,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 0,
      });
      await ctx.db.insert("pipes", {
        userId,
        parentId: boilerId,
        name: "Reserve",
        icon: "wallet-outline",
        priority: 0,
        capacity: MAX_AMOUNT,
        fed: MAX_AMOUNT,
        spent: 0,
      });
      return { userId, boilerId };
    });

    await expect(
      contributeAndReadOperation(t, t.withIdentity({ subject: userId }), {
          pipeId: boilerId,
          title: "Correction",
          value: 0,
          currentFed: -MAX_AMOUNT,
          date: 3000,
        }),
    ).rejects.toThrow("Amount exceeds the maximum allowed value");

    const boiler = await t.run((ctx) => ctx.db.get("pipes", boilerId));
    expect(boiler?.fed).toBe(0);
  });

  it("adjusts boiler principal when its feed transaction is edited", async () => {
    const t = convexTest(schema, modules);
    const { userId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Savings",
        icon: "water-boiler",
        priority: 0,
        capacity: 0,
        fed: 0,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 0,
      });
      return { userId, boilerId };
    });
    const asUser = t.withIdentity({ subject: userId });
    const created = await contributeAndReadOperation(t, asUser, {
        pipeId: boilerId,
        title: "Investment",
        value: 30000,
        date: 3000,
      });
    if (!created) throw new Error("Expected a contribution transaction");

    await asUser.mutation(api.financialOperations.edit, {
      operationId: created.id,
      title: "Investment",
      value: 20000,
      date: 3000,
    });

    const boiler = await t.run((ctx) => ctx.db.get("pipes", boilerId));
    expect(boiler).toMatchObject({ fed: 20000, contributedFed: 20000 });
  });

  it("rejects a transfer to a non-root destination without changing accounting", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId } = await t.run(async (ctx) => {
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
        fed: 1000,
        spent: 0,
      });
      const destinationRootId = await ctx.db.insert("pipes", {
        userId,
        name: "Destination root",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId,
        parentId: destinationRootId,
        name: "Destination child",
        icon: "cash-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId, destinationId };
    });
    const asUser = t.withIdentity({ subject: userId });

    await expect(
      createAndReadOperation(t, asUser, {
        title: "transfer",
        value: -100,
        date: 3000,
        from: sourceId,
        to: destinationId,
      }),
    ).rejects.toMatchObject({
      data: { code: "TRANSFER_DESTINATION_NOT_ROOT" },
    });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 1000, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transactions).toEqual([]);
    expect(state.titleUsage).toEqual([]);
  });

  it("rejects a transfer to the source pipe's own root", async () => {
    const t = convexTest(schema, modules);
    const { userId, rootId, sourceId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const rootId = await ctx.db.insert("pipes", {
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
        parentId: rootId,
        name: "Source leaf",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, rootId, sourceId };
    });

    await expect(
      createAndReadOperation(t, t.withIdentity({ subject: userId }), {
          title: "transfer",
          value: -100,
          date: 3000,
          from: sourceId,
          to: rootId,
        }),
    ).rejects.toMatchObject({ data: { code: "TRANSFER_SAME_TREE" } });

    const state = await t.run(async (ctx) => ({
      root: await ctx.db.get("pipes", rootId),
      source: await ctx.db.get("pipes", sourceId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.root).toMatchObject({ fed: 500, spent: 0 });
    expect(state.source).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transactions).toEqual([]);
    expect(state.titleUsage).toEqual([]);
  });

  it("rejects a transfer from a pipe with children", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        name: "Source parent",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      await ctx.db.insert("pipes", {
        userId,
        parentId: sourceId,
        name: "Source child",
        icon: "cash-outline",
        priority: 0,
        capacity: 500,
        fed: 500,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId,
        name: "Destination root",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId, destinationId };
    });

    await expect(
      createAndReadOperation(t, t.withIdentity({ subject: userId }), {
          title: "transfer",
          value: -100,
          date: 3000,
          from: sourceId,
          to: destinationId,
        }),
    ).rejects.toMatchObject({ data: { code: "TRANSFER_SOURCE_NOT_LEAF" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 1000, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transactions).toEqual([]);
    expect(state.titleUsage).toEqual([]);
  });

  it("rejects an ordinary expense from a pipe with children", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        name: "Source parent",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      await ctx.db.insert("pipes", {
        userId,
        parentId: sourceId,
        name: "Source child",
        icon: "cash-outline",
        priority: 0,
        capacity: 500,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId };
    });

    await expect(
      createAndReadOperation(t, t.withIdentity({ subject: userId }), {
          title: "expense",
          value: -100,
          date: 3000,
          from: sourceId,
        }),
    ).rejects.toMatchObject({ data: { code: "SOURCE_HAS_CHILDREN" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 1000, spent: 0 });
    expect(state.transactions).toEqual([]);
    expect(state.titleUsage).toEqual([]);
  });

  it("rejects a transfer to another user's root without revealing it", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId } = await t.run(async (ctx) => {
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
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        name: "Source",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign destination",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId, destinationId };
    });

    await expect(
      createAndReadOperation(t, t.withIdentity({ subject: userId }), {
          title: "transfer",
          value: -100,
          date: 3000,
          from: sourceId,
          to: destinationId,
        }),
    ).rejects.toMatchObject({ data: { code: "TRANSACTION_PIPE_NOT_FOUND" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(state.source).toMatchObject({ fed: 1000, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transactions).toEqual([]);
    expect(state.titleUsage).toEqual([]);
  });

  it("rejects a transfer from another user's pipe without revealing it", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId } = await t.run(async (ctx) => {
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
      const sourceId = await ctx.db.insert("pipes", {
        userId: otherUserId,
        name: "Foreign source",
        icon: "wallet-outline",
        priority: 0,
        capacity: 1000,
        fed: 1000,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId,
        name: "Destination",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId, destinationId };
    });

    await expect(
      createAndReadOperation(t, t.withIdentity({ subject: userId }), {
          title: "transfer",
          value: -100,
          date: 3000,
          from: sourceId,
          to: destinationId,
        }),
    ).rejects.toMatchObject({ data: { code: "TRANSACTION_PIPE_NOT_FOUND" } });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await readOperations(ctx),
    }));
    expect(state.source).toMatchObject({ fed: 1000, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 500, spent: 0 });
    expect(state.transactions).toEqual([]);
  });

  it("conserves cents for a valid cross-tree transfer", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, destinationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const sourceRootId = await ctx.db.insert("pipes", {
        userId,
        name: "Source root",
        icon: "wallet-outline",
        priority: 0,
        capacity: 700,
        fed: 0,
        spent: 0,
      });
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        parentId: sourceRootId,
        name: "Source leaf",
        icon: "cash-outline",
        priority: 0,
        capacity: 700,
        fed: 700,
        spent: 0,
      });
      const destinationId = await ctx.db.insert("pipes", {
        userId,
        name: "Destination root",
        icon: "bank",
        priority: 0,
        capacity: 1000,
        fed: 500,
        spent: 0,
      });
      return { userId, sourceId, destinationId };
    });

    const result = await createAndReadOperation(t, t.withIdentity({ subject: userId }), {
        title: "  SAVINGS  ",
        value: -100,
        date: 3000,
        from: sourceId,
        to: destinationId,
      });

    const state = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      destination: await ctx.db.get("pipes", destinationId),
      transactions: await readOperations(ctx),
      titleUsage: await ctx.db.query("transactionTitleUsage").collect(),
    }));
    expect(result).toMatchObject({ id: expect.anything() });
    expect(state.source).toMatchObject({ fed: 600, spent: 0 });
    expect(state.destination).toMatchObject({ fed: 600, spent: 0 });
    expect((state.source?.fed ?? 0) + (state.destination?.fed ?? 0)).toBe(1200);
    expect(state.transactions).toHaveLength(1);
    expect(state.transactions[0]).toMatchObject({
      title: "savings",
      kind: "transfer",
      value: -100,
      from: sourceId,
      to: destinationId,
    });
    expect(state.titleUsage).toHaveLength(1);
    expect(state.titleUsage[0]).toMatchObject({
      pipeId: sourceId,
      title: "savings",
      count: 1,
    });
  });

  it("tracks boiler principal through a transfer and signed edit", async () => {
    const t = convexTest(schema, modules);
    const { userId, sourceId, boilerId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const sourceId = await ctx.db.insert("pipes", {
        userId,
        name: "Source",
        icon: "cash-outline",
        priority: 0,
        capacity: 700,
        fed: 700,
        spent: 0,
      });
      const boilerId = await ctx.db.insert("pipes", {
        userId,
        name: "Boiler",
        icon: "water-boiler",
        priority: 0,
        capacity: 500,
        fed: 500,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 500,
      });
      return { userId, sourceId, boilerId };
    });

    const transaction = await createAndReadOperation(t, t.withIdentity({ subject: userId }), {
        title: "Investment transfer",
        value: -100,
        date: 3000,
        from: sourceId,
        to: boilerId,
      });

    const afterCreation = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      boiler: await ctx.db.get("pipes", boilerId),
    }));
    expect(afterCreation.source).toMatchObject({ fed: 600 });
    expect(afterCreation.boiler).toMatchObject({
      fed: 600,
      contributedFed: 600,
    });
    expect(
      (afterCreation.source?.fed ?? 0) + (afterCreation.boiler?.fed ?? 0),
    ).toBe(1200);

    await t.withIdentity({ subject: userId }).mutation(
      api.financialOperations.edit,
      {
        operationId: transaction.id,
        title: "Investment transfer",
        value: 40,
        date: 3000,
      },
    );

    const afterEdit = await t.run(async (ctx) => ({
      source: await ctx.db.get("pipes", sourceId),
      boiler: await ctx.db.get("pipes", boilerId),
    }));
    expect(afterEdit.source).toMatchObject({ fed: 740 });
    expect(afterEdit.boiler).toMatchObject({
      fed: 460,
      contributedFed: 460,
    });
    expect((afterEdit.source?.fed ?? 0) + (afterEdit.boiler?.fed ?? 0)).toBe(
      1200,
    );
  });

  it("scopes event history to financial from, to, and paidFrom perspectives", async () => {
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
        {
          title: "paid",
          kind: "expense" as const,
          from: otherPipeId,
          paidFrom: selectedPipeId,
        },
        { title: "unrelated", kind: "expense" as const, from: otherPipeId },
      ];
      for (const [index, row] of rows.entries()) {
        await insertFinancialOperation(ctx, { userId, title: row.title, value: row.kind === "feed" ? 1 : -1, occurredAt: index,
          structure: row.kind === "feed" ? { type: "feed", to: row.to } : row.paidFrom
            ? { type: "payByTransfer", from: row.from, paidFrom: row.paidFrom } : { type: "expense", from: row.from } });
      }
      return { userId, selectedPipeId };
    });

    const transactions = await t
      .withIdentity({ subject: userId })
      .query(api.events.latest, {
        pipeId: selectedPipeId,
      });

    expect(
      transactions
        .flatMap(event => "title" in event ? [event.title] : [])
        .sort(),
    ).toEqual(["from", "paid", "to"]);
  });

  it("accepts Convex pagination metadata for correction history", async () => {
    const t = convexTest(schema, modules);
    const { userId, operationId } = await t.run(async (ctx) => {
      const userId = await ctx.db.insert("users", {
        username: "alice",
        email: "alice@example.com",
        password: "hash",
      });
      const pipeId = await ctx.db.insert("pipes", { userId, name: "Food", icon: "food", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const operationId = await insertOperation(ctx, {
        userId,
        from: pipeId,
        title: "old",
        kind: "expense",
        value: -10,
        date: 100,
      });
      await ctx.db.insert("transactionCorrections", {
        operationId,
        userId,
        editedAt: 200,
        previous: { title: "old", value: -10, date: 100 },
        current: { title: "new", value: -12, date: 200 },
      });
      return { userId, operationId };
    });

    const result = await t
      .withIdentity({ subject: userId })
      .query(api.operationCorrections.list, {
        operationId,
        paginationOpts: { numItems: 20, cursor: null },
      });

    expect(result.page).toHaveLength(1);
    expect(result.pageStatus).toBeNull();
    expect(result.splitCursor).toBeNull();
  });

  it("keeps a refund's logical spending on its pipe while restoring liquidity elsewhere", async () => {
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

    await createAndReadOperation(t, t
      .withIdentity({ subject: userId }), {
        title: "coffee refund",
        value: 250,
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
      spent: 250,
      pendingFedAdjustment: -250,
    });
    expect(bank).toMatchObject({ fed: 1250 });
  });

  it("keeps a paid-by expense on its logical pipe while reducing liquidity elsewhere", async () => {
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

    await createAndReadOperation(t, t
      .withIdentity({ subject: userId }), {
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
      spent: 300,
      pendingFedAdjustment: 300,
    });
    expect(bank).toMatchObject({ fed: 700 });
  });

  it("edits a pay-by transaction through logical spending and external liquidity", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId, bankId, operationId } = await t.run(
      async (ctx) => {
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
          pendingFedAdjustment: 500,
        });
        const bankId = await ctx.db.insert("pipes", {
          userId,
          name: "Bank",
          icon: "bank",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        const operationId = await insertOperation(ctx, {
          userId,
          title: "coffee",
          kind: "expense",
          value: -500,
          date: 2000,
          from: coffeeId,
          paidFrom: bankId,
        });
        return { userId, coffeeId, bankId, operationId };
      },
    );

    await t
      .withIdentity({ subject: userId })
      .mutation(api.financialOperations.edit, {
        operationId,
        title: "coffee",
        value: -250,
        date: 3000,
      });

    const pipes = await t
      .withIdentity({ subject: userId })
      .query(api.pipes.getPipes, {});
    const coffee = pipes.find((pipe) => pipe._id === coffeeId);
    const bank = pipes.find((pipe) => pipe._id === bankId);

    expect(coffee).toMatchObject({
      fed: 1000,
      spent: 250,
      pendingFedAdjustment: 250,
    });
    expect(bank).toMatchObject({ fed: 750 });
  });

  it("preserves a legacy pay-by balance when editing its value", async () => {
    const t = convexTest(schema, modules);
    const { userId, coffeeId, bankId, operationId } = await t.run(
      async (ctx) => {
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
        });
        const bankId = await ctx.db.insert("pipes", {
          userId,
          name: "Bank",
          icon: "bank",
          priority: 0,
          capacity: 1000,
          fed: 500,
          spent: 0,
        });
        const operationId = await insertOperation(ctx, {
          userId,
          title: "coffee",
          kind: "expense",
          value: -500,
          date: 2000,
          from: coffeeId,
          paidFrom: bankId,
        });
        return { userId, coffeeId, bankId, operationId };
      },
    );

    await t.withIdentity({ subject: userId }).mutation(api.financialOperations.edit, {
      operationId,
      title: "coffee",
      value: -250,
      date: 3000,
    });

    const pipes = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});
    const coffee = pipes.find((pipe) => pipe._id === coffeeId);
    const bank = pipes.find((pipe) => pipe._id === bankId);

    expect(coffee).toMatchObject({
      fed: 1000,
      spent: 250,
      pendingFedAdjustment: -250,
    });
    expect(bank).toMatchObject({ fed: 750 });
    expect((coffee?.fed ?? 0) + (coffee?.pendingFedAdjustment ?? 0) - (coffee?.spent ?? 0)).toBe(500);
  });

  it("applies an edit after settlement to the current period and reruns instant settlement", async () => {
    const t = convexTest(schema, modules);
    const { userId, operationId } = await t.run(async (ctx) => {
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
        fed: 950,
        spent: 0,
        rule: "instant_settlement",
      });
      const operationId = await insertOperation(ctx, {
        userId,
        title: "coffee",
        kind: "expense",
        value: -50,
        date: 2000,
        from: pipeId,
      });
      return { userId, operationId };
    });

    await t.withIdentity({ subject: userId }).mutation(api.financialOperations.edit, {
      operationId,
      title: "coffee",
      value: -80,
      date: 3000,
    });

    const [pipe] = await t.withIdentity({ subject: userId }).query(api.pipes.getPipes, {});
    expect(pipe).toMatchObject({ fed: 920, spent: 0, pendingFedAdjustment: 0 });
  });

  it("trims and lowercases transaction titles before persistence and recent-title lookup", async () => {
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
      });
      return { userId, pipeId };
    });
    const asUser = t.withIdentity({ subject: userId });

    const created = await createAndReadOperation(t, asUser, {
      title: "  COFFEE  ",
      value: -10,
      date: 3000,
      from: pipeId,
    });

    const transactions = await asUser.query(api.events.latest, {
      pipeId,
    });
    const recentTitles = await asUser.query(api.transactions.listRecentTitles, { pipeId });

    expect(transactions[0]).toMatchObject({ title: "coffee" });
    expect(recentTitles).toEqual(["coffee"]);

    await asUser.mutation(api.financialOperations.edit, {
      operationId: created.id,
      title: "  LATTE  ",
      value: -10,
      date: 3000,
    });

    const editedTransactions = await asUser.query(api.events.latest, {
      pipeId,
    });
    expect(editedTransactions[0]).toMatchObject({ title: "latte" });

    await expect(
      createAndReadOperation(t, asUser, {
        title: "   ",
        value: -10,
        date: 4000,
        from: pipeId,
      }),
    ).rejects.toThrow("Transaction title cannot be empty");
  });
});
