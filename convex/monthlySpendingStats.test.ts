// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";

it("captures the previous UTC month's spending once for every user", async () => {
  const t = convexTest(schema, modules);
  const now = Date.UTC(2026, 6, 1, 5);
  const juneStart = Date.UTC(2026, 5, 1);
  const julyStart = Date.UTC(2026, 6, 1);

  await t.run(async (ctx) => {
    const activeUserId = await ctx.db.insert("users", {
      username: "active",
      email: "active@example.com",
      password: "hash",
    });
    await ctx.db.insert("users", {
      username: "inactive",
      email: "inactive@example.com",
      password: "hash",
    });

    for (const transaction of [
      { kind: "expense" as const, value: -1_200, date: juneStart },
      { kind: "expense" as const, value: -800, date: julyStart - 1 },
      { kind: "expense" as const, value: 250, date: juneStart + 1 },
      { kind: "feed" as const, value: 50_000, date: juneStart + 2 },
      { kind: "transfer" as const, value: -10_000, date: juneStart + 3 },
      { kind: "expense" as const, value: -9_999, date: juneStart - 1 },
      { kind: "expense" as const, value: -9_999, date: julyStart },
    ]) {
      await ctx.db.insert("transactions", {
        ...transaction,
        title: "test transaction",
        userId: activeUserId,
      });
    }
  });

  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now });
  vi.useFakeTimers();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  const stats = await t.run((ctx) =>
    ctx.db.query("monthlySpendingStats").collect(),
  );
  expect(stats).toHaveLength(2);
  expect(stats).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        periodStart: juneStart,
        totalIncomeCents: 50_000,
        grossSpendingCents: 2_000,
        refundCents: 250,
        spendingTransactionCount: 2,
        refundTransactionCount: 1,
        largestSpendingTransactionCents: 1_200,
      }),
      expect.objectContaining({
        periodStart: juneStart,
        totalIncomeCents: 0,
        grossSpendingCents: 0,
        refundCents: 0,
        spendingTransactionCount: 0,
        refundTransactionCount: 0,
        largestSpendingTransactionCents: 0,
      }),
    ]),
  );
});

it("captures volume and produced from the user's root feeds and boilers", async () => {
  const t = convexTest(schema, modules);
  const now = Date.UTC(2026, 6, 1, 5);
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      username: "snapshot-owner",
      email: "snapshot-owner@example.com",
      password: "hash",
    });
    const otherUserId = await ctx.db.insert("users", {
      username: "snapshot-other",
      email: "snapshot-other@example.com",
      password: "hash",
    });
    const rootId = await ctx.db.insert("pipes", {
      userId,
      name: "Income",
      icon: "bank",
      priority: 1,
      capacity: 10_000,
      fed: 10_000,
      spent: 2_000,
      sourceType: "feed",
    });
    await ctx.db.insert("pipes", {
      userId,
      name: "Investment",
      icon: "trending-up",
      priority: 2,
      capacity: 15_000,
      fed: 15_000,
      spent: 1_000,
      sourceType: "boiler",
      contributedFed: 12_000,
    });
    await ctx.db.insert("pipes", {
      userId,
      parentId: rootId,
      name: "Child",
      icon: "cash-outline",
      priority: 1,
      capacity: 5_000,
      fed: 5_000,
      spent: 500,
    });
    await ctx.db.insert("pipes", {
      userId: otherUserId,
      name: "Foreign",
      icon: "bank",
      priority: 1,
      capacity: 99_999,
      fed: 99_999,
      spent: 0,
      sourceType: "feed",
    });
    return userId;
  });

  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now });
  vi.useFakeTimers();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  const stat = await t
    .withIdentity({ subject: userId })
    .query(api.monthlySpendingStats.getMine, {
      periodStart: Date.UTC(2026, 5, 1),
    });
  expect(stat).toMatchObject({
    volumeCents: 22_000,
    producedCents: 19_000,
  });
});

it("finishes paginated capture and preserves the frozen result on rerun", async () => {
  const t = convexTest(schema, modules);
  const now = Date.UTC(2026, 6, 1, 5);
  const juneStart = Date.UTC(2026, 5, 1);
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", {
      username: "paginated",
      email: "paginated@example.com",
      password: "hash",
    });
    for (let index = 0; index < 101; index += 1) {
      await ctx.db.insert("transactions", {
        title: `expense ${index}`,
        value: -100,
        date: juneStart + index,
        kind: "expense",
        userId: id,
      });
    }
    return id;
  });

  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now });
  vi.useFakeTimers();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  await t.run((ctx) =>
    ctx.db.insert("transactions", {
      title: "late entry",
      value: -50_000,
      date: juneStart,
      kind: "expense",
      userId,
    }),
  );
  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now });
  vi.useFakeTimers();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();

  const stats = await t.run((ctx) =>
    ctx.db.query("monthlySpendingStats").collect(),
  );
  expect(stats).toHaveLength(1);
  expect(stats[0]).toMatchObject({
    userId,
    periodStart: juneStart,
    grossSpendingCents: 10_100,
    spendingTransactionCount: 101,
    largestSpendingTransactionCents: 100,
  });
});

it("lists only the authenticated user's monthly summaries newest first", async () => {
  const t = convexTest(schema, modules);
  const { aliceId } = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      username: "alice",
      email: "alice@example.com",
      password: "hash",
    });
    const bobId = await ctx.db.insert("users", {
      username: "bob",
      email: "bob@example.com",
      password: "hash",
    });
    const baseSummary = {
      grossSpendingCents: 2_000,
      refundCents: 250,
      spendingTransactionCount: 2,
      refundTransactionCount: 1,
      largestSpendingTransactionCents: 1_200,
    };
    await ctx.db.insert("monthlySpendingStats", {
      userId: aliceId,
      periodStart: Date.UTC(2026, 4, 1),
      ...baseSummary,
    });
    await ctx.db.insert("monthlySpendingStats", {
      userId: aliceId,
      periodStart: Date.UTC(2026, 5, 1),
      ...baseSummary,
      grossSpendingCents: 3_000,
    });
    await ctx.db.insert("monthlySpendingStats", {
      userId: bobId,
      periodStart: Date.UTC(2026, 5, 1),
      ...baseSummary,
      grossSpendingCents: 99_999,
    });
    return { aliceId };
  });
  await expect(
    t.query(api.monthlySpendingStats.listMine, {}),
  ).rejects.toThrow("Not authenticated");

  const result = await t
    .withIdentity({ subject: aliceId })
    .query(api.monthlySpendingStats.listMine, {});

  expect(result.map((row) => row.periodStart)).toEqual([
    Date.UTC(2026, 5, 1),
    Date.UTC(2026, 4, 1),
  ]);
  expect(result[0]).toEqual({
    periodStart: Date.UTC(2026, 5, 1),
    grossSpendingCents: 3_000,
    refundCents: 250,
    spendingTransactionCount: 2,
    refundTransactionCount: 1,
    largestSpendingTransactionCents: 1_200,
  });
});

it("returns an exact monthly report only to its owner", async () => {
  const t = convexTest(schema, modules);
  const periodStart = Date.UTC(2026, 5, 1);
  const { aliceId, bobId } = await t.run(async (ctx) => {
    const aliceId = await ctx.db.insert("users", {
      username: "alice-detail",
      email: "alice-detail@example.com",
      password: "hash",
    });
    const bobId = await ctx.db.insert("users", {
      username: "bob-detail",
      email: "bob-detail@example.com",
      password: "hash",
    });
    await ctx.db.insert("monthlySpendingStats", {
      userId: aliceId,
      periodStart,
      grossSpendingCents: 4_000,
      refundCents: 500,
      spendingTransactionCount: 4,
      refundTransactionCount: 1,
      largestSpendingTransactionCents: 1_500,
    });
    return { aliceId, bobId };
  });

  const report = await t
    .withIdentity({ subject: aliceId })
    .query(api.monthlySpendingStats.getMine, { periodStart });
  const hidden = await t
    .withIdentity({ subject: bobId })
    .query(api.monthlySpendingStats.getMine, { periodStart });
  await expect(
    t
      .withIdentity({ subject: aliceId })
      .query(api.monthlySpendingStats.getMine, { periodStart: periodStart + 1 }),
  ).rejects.toThrow("Invalid period start");

  expect(report).toEqual({
    periodStart,
    grossSpendingCents: 4_000,
    refundCents: 500,
    spendingTransactionCount: 4,
    refundTransactionCount: 1,
    largestSpendingTransactionCents: 1_500,
  });
  expect(hidden).toBeNull();
});
