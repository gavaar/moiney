// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertFinancialOperation } from "../lib/events/financial";
import { ensureLivePipeCreationHistory } from "../lib/pipeHistory";
import { startPipeDeletionOperation, processPipeDeletionOperation } from "../lib/pipes/delete/operations";

it.each([false, true])("applies orphan-history policy to event-only operations (delete=%s)", async deleteTransactions => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
    const deleted = await ctx.db.insert("pipes", { ...fields, name: "Deleted" });
    const survivor = await ctx.db.insert("pipes", { ...fields, name: "Survivor" });
    await ensureLivePipeCreationHistory(ctx, (await ctx.db.get("pipes", deleted))!);
    const orphan = await insertFinancialOperation(ctx, { userId, title: "orphan", value: -100, occurredAt: 1, structure: { type: "expense", from: deleted } });
    const shared = await insertFinancialOperation(ctx, { userId, title: "shared", value: -200, occurredAt: 2, structure: { type: "payByTransfer", from: deleted, paidFrom: survivor } });
    for (let i = 0; i < 125; i++) await ctx.db.insert("transactionCorrections", { userId, operationId: orphan, editedAt: i + 3,
      previous: { title: "old", value: -100, date: 1 }, current: { title: "orphan", value: -100, date: 1 } });
    return { userId, deleted, survivor, orphan, shared };
  });
  vi.useFakeTimers();
  try {
    const auth = t.withIdentity({ subject: ids.userId });
    const job = await auth.mutation(api.pipes.startPipeDeletion, { pipeId: ids.deleted, deleteTransactions });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await auth.query(api.pipes.getPipeDeletionStatus, { jobId: job.jobId })).toMatchObject({ phase: "complete" });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events.filter(event => event.operationId === ids.orphan)).toHaveLength(deleteTransactions ? 0 : 1);
    expect(events.filter(event => event.operationId === ids.shared)).toHaveLength(2);
    expect(events.filter(event => event.type === "pipe_creation" || event.type === "pipe_deletion")).toHaveLength(2);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toHaveLength(deleteTransactions ? 0 : 125);
    expect(await t.run(ctx => ctx.db.get("pipes", ids.deleted))).toBeNull();
  } finally { vi.useRealTimers(); }
});

it("keeps canonical lifecycle dates, ancestry and final presentation without a legacy lifecycle row", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
    const root = await ctx.db.insert("pipes", { ...fields, name: "Root" });
    const child = await ctx.db.insert("pipes", { ...fields, name: "Child", parentId: root });
    await ensureLivePipeCreationHistory(ctx, (await ctx.db.get("pipes", child))!);
    const creation = (await ctx.db.query("events").collect())[0];
    const job = await startPipeDeletionOperation(ctx, userId, { pipeId: child, deleteTransactions: false }, async () => {});
    return { userId, root, child, creation, ...job };
  });
  await t.run(ctx => processPipeDeletionOperation(ctx, ids.jobId, async () => {}));
  await t.run(async ctx => {
    await ctx.db.patch("pipes", ids.root, { name: "Final root", icon: "airplane" });
  });
  await t.run(ctx => processPipeDeletionOperation(ctx, ids.jobId, async () => {}));
  const events = await t.run(ctx => ctx.db.query("events").collect());
  expect(events).toHaveLength(2);
  expect(events.find(event => event._id === ids.creation._id)).toMatchObject({ occurredAt: ids.creation.occurredAt, parentName: "Final root", parentIcon: "airplane", ancestorIds: [ids.root] });
  expect(events.find(event => event.type === "pipe_deletion")).toMatchObject({ parentName: "Final root", parentIcon: "airplane", ancestorIds: [ids.root] });
  expect(await t.run(ctx => ctx.db.get("pipes", ids.child))).toBeNull();
});

it.each(["processingTransactions", "readyToFinalize", "complete"] as const)("handles a retired legacy job in phase %s without changing stored data", async phase => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Deleted", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
    await insertFinancialOperation(ctx, { userId, title: "old", value: -1, occurredAt: 1, structure: { type: "expense", from: pipeId } });
    const job = await startPipeDeletionOperation(ctx, userId, { pipeId, deleteTransactions: true }, async () => {});
    await ctx.db.patch("pipeDeletionJobs", job.jobId, { historySource: undefined, phase, role: "from", cursor: "retired-transaction-cursor" });
    return { ...job, pipeId };
  });
  const before = await t.run(async ctx => ({ job: await ctx.db.get("pipeDeletionJobs", ids.jobId), pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }));
  if (phase === "complete") expect(await t.run(ctx => processPipeDeletionOperation(ctx, ids.jobId, async () => {}))).toBeNull();
  else await expect(t.run(ctx => processPipeDeletionOperation(ctx, ids.jobId, async () => {}))).rejects.toThrow("Legacy pipe deletion job is no longer supported");
  expect(await t.run(async ctx => ({ job: await ctx.db.get("pipeDeletionJobs", ids.jobId), pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }))).toEqual(before);
});

it.each([false, true])("creates and deletes lifecycle events with deleteHistory=%s", async deleteTransactions => {
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { username: "alice", email: "a", password: "hash" }));
  const auth = t.withIdentity({ subject: userId });
  const pipeId = await auth.mutation(api.pipes.addFeed, { name: "Wallet", icon: "wallet" });
  vi.useFakeTimers();
  try {
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId, deleteTransactions });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally { vi.useRealTimers(); }
  const events = await t.run(ctx => ctx.db.query("events").collect());
  expect(events.map(event => event.type).sort()).toEqual(deleteTransactions ? [] : ["pipe_creation", "pipe_deletion"]);
  expect(events.every(event => "name" in event && event.name === "Wallet")).toBe(true);
});

it("rejects an incomplete operation atomically without advancing its job cursor", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const fields = { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
    const source = await ctx.db.insert("pipes", fields);
    const payer = await ctx.db.insert("pipes", fields);
    const operationId = await insertFinancialOperation(ctx, { userId, title: "broken", value: -1, occurredAt: 1, structure: { type: "payByTransfer", from: source, paidFrom: payer } });
    const counterpart = (await ctx.db.query("events").collect()).find(event => event._id !== operationId)!;
    await ctx.db.delete("events", counterpart._id);
    return startPipeDeletionOperation(ctx, userId, { pipeId: source, deleteTransactions: true }, async () => {});
  });
  const before = await t.run(async ctx => ({ job: await ctx.db.get("pipeDeletionJobs", ids.jobId), events: await ctx.db.query("events").collect(), pipes: await ctx.db.query("pipes").collect() }));
  await expect(t.run(ctx => processPipeDeletionOperation(ctx, ids.jobId, async () => {}))).rejects.toThrow("counterpart");
  expect(await t.run(async ctx => ({ job: await ctx.db.get("pipeDeletionJobs", ids.jobId), events: await ctx.db.query("events").collect(), pipes: await ctx.db.query("pipes").collect() }))).toEqual(before);
});

it.each([
  { fed: 40, spent: 10, pending: 5, parentFed: 135 },
  { fed: 10, spent: 40, pending: -5, parentFed: 65 },
])("bounds event pages and credits a signed subtree balance once (parent=$parentFed)", async ({ fed, spent, pending, parentFed }) => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const fields = { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 100, fed: 100, spent: 0 };
    const parent = await ctx.db.insert("pipes", fields);
    const child = await ctx.db.insert("pipes", { ...fields, parentId: parent, fed, spent, pendingFedAdjustment: pending });
    for (let i = 0; i < 110; i++) await insertFinancialOperation(ctx, { userId, title: "orphan", value: -1, occurredAt: i, structure: { type: "expense", from: child } });
    return { userId, parent, child };
  });
  vi.useFakeTimers();
  try {
    const job = await t.withIdentity({ subject: ids.userId }).mutation(api.pipes.startPipeDeletion, { pipeId: ids.child, deleteTransactions: true });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toHaveLength(60);
    expect(await t.run(ctx => ctx.db.get("pipeDeletionJobs", job.jobId))).toMatchObject({ historySource: "events", phase: "processingTransactions", cursor: expect.any(String) });
    expect(await t.run(ctx => ctx.db.get("pipes", ids.parent))).toMatchObject({ fed: 100 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.get("pipes", ids.parent))).toMatchObject({ fed: parentFed });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.get("pipes", ids.parent))).toMatchObject({ fed: parentFed });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  } finally { vi.useRealTimers(); }
});

it("preserves complete paired operations across tied-date payer-only pages", async () => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "a", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 };
    const source = await ctx.db.insert("pipes", { ...fields, name: "Source" });
    const payer = await ctx.db.insert("pipes", { ...fields, name: "Payer" });
    for (let i = 0; i < 51; i++) await insertFinancialOperation(ctx, { userId, title: "shared", value: -1, occurredAt: 1,
      structure: { type: "payByTransfer", from: source, paidFrom: payer } });
    return { userId, payer };
  });
  const originalEvents = await t.run(ctx => ctx.db.query("events").collect());
  vi.useFakeTimers();
  try {
    const job = await t.withIdentity({ subject: ids.userId }).mutation(api.pipes.startPipeDeletion, { pipeId: ids.payer, deleteTransactions: true });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.get("pipeDeletionJobs", job.jobId))).toMatchObject({ phase: "processingTransactions", cursor: expect.any(String) });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events.filter(event => event.type !== "pipe_creation" && event.type !== "pipe_deletion")).toEqual(originalEvents);
    expect(events.filter(event => event.type === "pipe_creation" || event.type === "pipe_deletion")).toHaveLength(2);
  } finally { vi.useRealTimers(); }
});
