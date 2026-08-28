// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { internal } from "./_generated/api";
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
        grossSpendingCents: 2_000,
        refundCents: 250,
        spendingTransactionCount: 2,
        refundTransactionCount: 1,
        largestSpendingTransactionCents: 1_200,
      }),
      expect.objectContaining({
        periodStart: juneStart,
        grossSpendingCents: 0,
        refundCents: 0,
        spendingTransactionCount: 0,
        refundTransactionCount: 0,
        largestSpendingTransactionCents: 0,
      }),
    ]),
  );
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
