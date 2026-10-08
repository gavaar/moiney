// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules } from "./test.setup";
import { insertFinancialOperation } from "./lib/events/financial";
import { insertHistoryOperation } from "./lib/events/persistence";

it("scheduled captures use event snapshots, not legacy rows, without restating frozen reports", async () => {
  const t = convexTest(schema, modules);
  const periodStart = Date.UTC(2026, 5, 1);
  const userId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "event-capture", email: "event-capture@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Root", icon: "wallet", priority: 0, fed: 1000, spent: 0, capacity: 1000 });
    await insertFinancialOperation(ctx, { userId, occurredAt: periodStart, title: "Event only", value: -100,
      structure: { type: "expense", from: pipeId } });
    await ctx.db.insert("transactions", { userId, title: "Legacy only", value: -9999, date: periodStart, kind: "expense", from: pipeId });
    return userId;
  });
  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now: Date.UTC(2026, 6, 1, 5) });
  vi.useFakeTimers();
  try { await t.finishAllScheduledFunctions(vi.runAllTimers); } finally { vi.useRealTimers(); }
  const report = await t.withIdentity({ subject: userId }).query(api.monthlySpendingStats.getMine, { periodStart });
  expect(report).toMatchObject({ grossSpendingCents: 100, spendingTransactionCount: 1, largestSpendingTransactions: [{ title: "Event only", amountCents: 100 }] });
  await t.run(async ctx => {
    for (const event of await ctx.db.query("events").collect()) await ctx.db.delete("events", event._id);
  });
  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now: Date.UTC(2026, 6, 1, 5) });
  vi.useFakeTimers();
  try { await t.finishAllScheduledFunctions(vi.runAllTimers); } finally { vi.useRealTimers(); }
  expect(await t.withIdentity({ subject: userId }).query(api.monthlySpendingStats.getMine, { periodStart })).toEqual(report);
});

it.each([false, true])("keeps event capture continuations idempotent (another capture already finished: %s)", async anotherCaptureFinished => {
  const t = convexTest(schema, modules);
  const periodStart = Date.UTC(2026, 5, 1);
  const periodEnd = Date.UTC(2026, 6, 1);
  const userId = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "continuation", email: "continuation@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Root", icon: "wallet", priority: 0, fed: 0, spent: 0, capacity: 0 });
    for (let i = 0; i < 101; i++) await insertFinancialOperation(ctx, {
      userId, title: "Event", value: -100, occurredAt: periodStart + i, structure: { type: "expense", from: pipeId },
    });
    await ctx.db.insert("transactions", { userId, from: pipeId, title: "Legacy only", kind: "expense", value: -9999, date: periodStart });
    return userId;
  });
  await t.mutation(internal.monthlySpendingStats.captureUserEventMonth, { userId, periodStart, periodEnd });
  expect(await t.run(ctx => ctx.db.query("monthlySpendingStats").collect())).toEqual([]);
  if (anotherCaptureFinished) {
    await t.run(async ctx => {
      await ctx.db.insert("monthlySpendingStats", { userId, periodStart,
        grossSpendingCents: 500, refundCents: 0, spendingTransactionCount: 1,
        refundTransactionCount: 0, largestSpendingTransactionCents: 500 });
      // A continuation must stop before reading a now-invalid event stream.
      for (const event of await ctx.db.query("events").collect()) await ctx.db.delete("events", event._id);
    });
  }
  vi.useFakeTimers();
  try { await t.finishAllScheduledFunctions(vi.runAllTimers); } finally { vi.useRealTimers(); }
  const stats = await t.run(ctx => ctx.db.query("monthlySpendingStats").collect());
  expect(stats).toHaveLength(1);
  expect(stats[0]).toMatchObject({ grossSpendingCents: anotherCaptureFinished ? 500 : 10100,
    spendingTransactionCount: anotherCaptureFinished ? 1 : 101 });
});

it("exhausts event pages before capture, counts logical spending once, and retains deleted-pipe activity", async () => {
  const t = convexTest(schema, modules);
  const periodStart = Date.UTC(2026, 5, 1);
  const periodEnd = Date.UTC(2026, 6, 1);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "paired-capture", email: "paired-capture@example.com", password: "hash" });
    const fields = { userId, name: "Root", icon: "wallet", priority: 0, fed: 5000, spent: 200, capacity: 5000 };
    const root = await ctx.db.insert("pipes", fields);
    const leaf = await ctx.db.insert("pipes", { ...fields, name: "Deleted leaf", parentId: root });
    for (let i = 0; i < 101; i++) await insertFinancialOperation(ctx, { userId, title: "Hotel", value: -100,
      occurredAt: periodStart + i, structure: { type: "payByTransfer", from: leaf, paidFrom: root } });
    await insertFinancialOperation(ctx, { userId, title: "Hotel", value: 25, occurredAt: periodStart,
      structure: { type: "payByTransfer", from: leaf, paidFrom: root } });
    await insertFinancialOperation(ctx, { userId, title: "Income", value: 500, occurredAt: periodStart,
      structure: { type: "feed", to: root } });
    await insertFinancialOperation(ctx, { userId, title: "Allocation", value: -900, occurredAt: periodStart,
      structure: { type: "transfer", from: root, to: leaf } });
    await insertHistoryOperation(ctx, { canonicalEvent: { userId, pipeId: leaf, type: "pipe_deletion",
      name: "Deleted leaf", icon: "wallet", pipeType: "pipe", ancestorIds: [root], occurredAt: periodStart } });
    await ctx.db.delete("pipes", leaf);
    return { userId, root };
  });
  await t.mutation(internal.monthlySpendingStats.captureUserEventMonth, { userId: ids.userId, periodStart, periodEnd });
  expect(await t.run(ctx => ctx.db.query("monthlySpendingStats").collect())).toEqual([]);
  vi.useFakeTimers();
  try { await t.finishAllScheduledFunctions(vi.runAllTimers); } finally { vi.useRealTimers(); }
  const report = await t.withIdentity({ subject: ids.userId }).query(api.monthlySpendingStats.getMine, { periodStart });
  expect(report).toMatchObject({ totalIncomeCents: 500, grossSpendingCents: 10100, refundCents: 25,
    spendingTransactionCount: 101, refundTransactionCount: 1, volumeCents: 4800, producedCents: 4800,
    mostRepeatedTransaction: { title: "hotel", count: 102, netSpendingCents: 10075 }, offenders: [] });
  expect(await t.run(ctx => ctx.db.get("pipes", ids.root))).toMatchObject({ fed: 5000, spent: 200 });
  expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual([]);
});

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
    const source = await ctx.db.insert("pipes", { userId: activeUserId, name: "Source", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const target = await ctx.db.insert("pipes", { userId: activeUserId, name: "Target", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });

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
      await insertFinancialOperation(ctx, { userId: activeUserId, title: "test transaction", value: transaction.value, occurredAt: transaction.date,
        structure: transaction.kind === "feed" ? { type: "feed", to: source } : transaction.kind === "transfer"
          ? { type: "transfer", from: source, to: target } : { type: "expense", from: source } });
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
        nextLargestSpendingCents: [800],
        largestSpendingTransactions: [
          { title: "test transaction", amountCents: 1_200 },
          { title: "test transaction", amountCents: 800 },
        ],
        mostRepeatedTransaction: { title: "test transaction", count: 3, netSpendingCents: 1_750 },
      }),
      expect.objectContaining({
        periodStart: juneStart,
        totalIncomeCents: 0,
        grossSpendingCents: 0,
        refundCents: 0,
        spendingTransactionCount: 0,
        refundTransactionCount: 0,
        largestSpendingTransactionCents: 0,
        nextLargestSpendingCents: [],
        largestSpendingTransactions: [],
        mostRepeatedTransaction: null,
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

it("freezes the top overspending leaves by net logical expenses and capacity at capture", async () => {
  const t = convexTest(schema, modules);
  const juneStart = Date.UTC(2026, 5, 1);
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { username: "offender", email: "offender@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Root", icon: "bank", priority: 1, capacity: 0, fed: 0, spent: 0 });
    const leaf = await ctx.db.insert("pipes", { userId, parentId: root, name: "Groceries", icon: "cash", priority: 1, capacity: 500, capUpdateValue: 10_000, fed: 0, spent: 0 });
    const payer = await ctx.db.insert("pipes", { userId, parentId: root, name: "Payer", icon: "cash", priority: 2, capacity: 200, fed: 0, spent: 0 });
    const debt = await ctx.db.insert("pipes", { userId, parentId: root, name: "Debt", icon: "cash", priority: 3, capacity: -1_000, fed: 0, spent: 0 });
    for (const [value, from, paidFrom] of [[-900, leaf, payer], [200, leaf, payer], [-150, payer, undefined], [-200, debt, undefined]] as const) {
      await ctx.db.insert("transactions", { userId, title: "Spend", kind: "expense", date: juneStart, value, from, ...(paidFrom ? { paidFrom } : {}) });
      await insertFinancialOperation(ctx, { userId, title: "Spend", value, occurredAt: juneStart,
        structure: paidFrom ? { type: "payByTransfer", from, paidFrom } : { type: "expense", from } });
    }
    return { userId, leaf, debt };
  });
  await t.mutation(internal.monthlySpendingStats.capturePreviousMonth, { now: Date.UTC(2026, 6, 1, 5) });
  vi.useFakeTimers();
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  vi.useRealTimers();
  const report = await t.withIdentity({ subject: userId.userId }).query(api.monthlySpendingStats.getMine, { periodStart: juneStart });
  expect(report?.offenders).toEqual([
    { pipeId: userId.leaf, name: "Groceries", netSpendingCents: 700, capacityCents: 500, overageCents: 200 },
    { pipeId: userId.debt, name: "Debt", netSpendingCents: 200, capacityCents: 0, overageCents: 200 },
  ]);
  await t.run(async (ctx) => ctx.db.patch("pipes", userId.leaf, { name: "Renamed", capacity: 10_000 }));
  const frozen = await t.withIdentity({ subject: userId.userId }).query(api.monthlySpendingStats.getMine, { periodStart: juneStart });
  expect(frozen?.offenders).toEqual(report?.offenders);
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
    const root = await ctx.db.insert("pipes", { userId: id, name: "Root", icon: "bank", priority: 1, capacity: 0, fed: 0, spent: 0 });
    const leaf = await ctx.db.insert("pipes", { userId: id, parentId: root, name: "Recurring", icon: "cash", priority: 1, capacity: 10_000, fed: 0, spent: 0 });
    for (let index = 0; index < 101; index += 1) {
      await ctx.db.insert("transactions", {
        title: index === 100 ? "expense 0" : `expense ${index}`,
        value: -100,
        date: juneStart + index,
        kind: "expense",
        userId: id,
        from: leaf,
      });
      await insertFinancialOperation(ctx, { userId: id, title: index === 100 ? "expense 0" : `expense ${index}`,
        value: -100, occurredAt: juneStart + index, structure: { type: "expense", from: leaf } });
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
    nextLargestSpendingCents: [100, 100],
    largestSpendingTransactions: [
      { title: "expense 0", amountCents: 100 },
      { title: "expense 0", amountCents: 100 },
      { title: "expense 1", amountCents: 100 },
    ],
    mostRepeatedTransaction: { title: "expense 0", count: 2, netSpendingCents: 200 },
    offenders: [expect.objectContaining({ name: "Recurring", netSpendingCents: 10_100, overageCents: 100 })],
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

it("returns bounded live monthly aggregates for the owner without persisting a current-month row", async () => {
  const t = convexTest(schema, modules);
  const periodStart = Date.UTC(2026, 5, 1);
  const userId = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { username: "live", email: "live@example.com", password: "hash" });
    const other = await ctx.db.insert("users", { username: "other-live", email: "other-live@example.com", password: "hash" });
    const fields = { name: "Root", icon: "wallet", priority: 0, fed: 0, spent: 0, capacity: 0 };
    const source = await ctx.db.insert("pipes", { ...fields, userId });
    const foreignSource = await ctx.db.insert("pipes", { ...fields, userId: other });
    for (const [value, owner, pipeId] of [[-600, userId, source], [100, userId, source], [-99_000, other, foreignSource]] as const) {
      await insertFinancialOperation(ctx, { userId: owner, title: "Spending", value, occurredAt: periodStart + 1,
        structure: { type: "expense", from: pipeId } });
    }
    await insertFinancialOperation(ctx, { userId, title: "Previous month", value: -250, occurredAt: Date.UTC(2026, 4, 10),
      structure: { type: "expense", from: source } });
    return userId;
  });
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 5, 15));
  try {
    await expect(t.query(api.monthlySpendingStats.eventMonthPage, { periodStart, paginationOpts: { numItems: 1, cursor: null } })).rejects.toThrow("Not authenticated");
    const owner = t.withIdentity({ subject: userId });
    const first = await owner.query(api.monthlySpendingStats.eventMonthPage, { periodStart, paginationOpts: { numItems: 1, cursor: null } });
    const second = await owner.query(api.monthlySpendingStats.eventMonthPage, { periodStart, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
    expect([...first.page, ...second.page].map((entry) => entry.summary.grossSpendingCents - entry.summary.refundCents).reduce((a, b) => a + b)).toBe(500);
    expect(second.isDone).toBe(true);
    expect(await t.run((ctx) => ctx.db.query("monthlySpendingStats").collect())).toEqual([]);
    vi.setSystemTime(Date.UTC(2026, 6, 15));
    const previous = await owner.query(api.monthlySpendingStats.eventMonthPage, { periodStart: Date.UTC(2026, 4, 1), paginationOpts: { numItems: 1, cursor: null } });
    expect(previous.page[0].summary.grossSpendingCents).toBe(250);
    await expect(owner.query(api.monthlySpendingStats.eventMonthPage, { periodStart: periodStart + 1, paginationOpts: { numItems: 1, cursor: null } })).rejects.toThrow("Invalid period start");
  } finally {
    vi.useRealTimers();
  }
});
