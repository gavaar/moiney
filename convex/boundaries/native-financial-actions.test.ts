// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import schema from "../schema";
import { modules } from "../test.setup";
import { insertFinancialOperation } from "../lib/events/financial";
import { api, internal } from "../_generated/api";

const { get, edit, remove, create, contributeToBoiler: boiler } = api.financialOperations;

async function setup(type: "expense" | "transfer" | "payByTransfer" | "feed", value = -100) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const otherId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const fields = { userId, icon: "wallet", priority: 0, capacity: 1000 };
    const source = await ctx.db.insert("pipes", { ...fields, name: "Source", fed: type === "transfer" ? 1000 + value : 1000,
      spent: type === "expense" || type === "payByTransfer" ? -value : 0,
      ...(type === "payByTransfer" ? { pendingFedAdjustment: -value } : {}) });
    const target = await ctx.db.insert("pipes", { ...fields, name: "Boiler", sourceType: "boiler",
      fed: type === "transfer" ? 1000 - value : type === "feed" || type === "payByTransfer" ? 1000 + value : 1000, spent: 0,
      contributedFed: type === "transfer" ? 1000 - value : type === "feed" ? 1000 + value : 1000 });
    const structure = type === "feed" ? { type, to: target } : type === "expense" ? { type, from: source }
      : type === "transfer" ? { type, from: source, to: target } : { type, from: source, paidFrom: target };
    const operationId = await insertFinancialOperation(ctx, { userId, title: "lunch", value, occurredAt: 1, structure });
    return { userId, otherId, source, target, operationId };
  });
  return { t, auth: t.withIdentity({ subject: ids.userId }), ...ids };
}

it.each([
  { type: "expense" as const, value: -100 }, { type: "expense" as const, value: 100 },
  { type: "transfer" as const, value: -100 }, { type: "transfer" as const, value: 100 },
  { type: "payByTransfer" as const, value: -100 }, { type: "payByTransfer" as const, value: 100 },
  { type: "feed" as const, value: 100 },
])("edits and removes an event-only $type operation with value $value exactly once", async ({ type, value }) => {
  const { t, auth, operationId, source, target } = await setup(type, value);
  const originalEntries = await t.run(ctx => ctx.db.query("events").collect());
  const row = await auth.query(get, { operationId });
  expect(row).toMatchObject({ operationId, title: "lunch", value, date: 1 });
  expect(row).not.toHaveProperty("transactionId");
  expect(row).not.toHaveProperty("userId");
  await auth.mutation(edit, { operationId, title: "dinner", value: value * 2, date: 2 });
  const entries = await t.run(ctx => ctx.db.query("events").collect());
  expect(entries.map(event => event._id)).toEqual(originalEntries.map(event => event._id));
  expect(entries.find(event => event._id === operationId)).toMatchObject({ title: "dinner", value: value * 2 });
  if (entries.length === 2) expect(entries.find(event => event._id !== operationId)).toMatchObject({ value: -value * 2 });
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  expect(corrections).toHaveLength(1);
  expect(corrections[0]).toMatchObject({ operationId, previous: { value }, current: { value: value * 2 } });
  expect(corrections[0]).not.toHaveProperty("transactionId");
  const updatedPipes = await t.run(async ctx => ({ source: await ctx.db.get("pipes", source), target: await ctx.db.get("pipes", target) }));
  if (type === "expense" || type === "payByTransfer") expect(updatedPipes.source!.spent).toBe(-value * 2);
  if (type === "transfer") expect(updatedPipes.source!.fed + updatedPipes.target!.fed).toBe(2000);
  if (type === "payByTransfer") expect(updatedPipes.source!.pendingFedAdjustment).toBe(-value * 2);
  if (type === "feed") expect(updatedPipes.target).toMatchObject({ fed: 1000 + value * 2, contributedFed: 1000 + value * 2 });
  await auth.mutation(edit, { operationId, title: "dinner", value: value * 2, date: 2 });
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual(corrections);
  vi.useFakeTimers();
  try {
    await auth.mutation(remove, { operationId });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  } finally { vi.useRealTimers(); }
  const restored = await t.run(async ctx => ({ source: await ctx.db.get("pipes", source), target: await ctx.db.get("pipes", target) }));
  expect(restored.source).toMatchObject({ fed: 1000, spent: 0 });
  expect(restored.target).toMatchObject({ fed: 1000, spent: 0, contributedFed: 1000 });
});

it.each(["foreign", "mirror", "incomplete"] as const)("rejects %s action targets without partial writes", async problem => {
  const { t, auth, operationId, otherId } = await setup("transfer");
  const mirror = (await t.run(ctx => ctx.db.query("events").collect())).find(event => event._id !== operationId)!;
  if (problem === "incomplete") await t.run(ctx => ctx.db.delete("events", mirror._id));
  const client = problem === "foreign" ? t.withIdentity({ subject: otherId }) : auth;
  const actionId = problem === "mirror" ? mirror._id : operationId;
  const before = await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }));
  await expect(client.mutation(edit, { operationId: actionId, title: "dinner", value: -200, date: 2 })).rejects.toThrow();
  await expect(client.mutation(remove, { operationId: actionId })).rejects.toThrow();
  expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  await expect(t.query(get, { operationId })).rejects.toThrow("Not authenticated");
  if (problem !== "incomplete") expect(await client.query(get, { operationId: actionId })).toBeNull();
});

it("converts event-native structure while preserving canonical identity and applying the net plan", async () => {
  const { t, auth, operationId, source, target } = await setup("expense");
  await auth.mutation(edit, { operationId, title: "move", value: -100, date: 1, target: { type: "transfer", to: target } });
  const transfer = await t.run(ctx => ctx.db.query("events").collect());
  expect(transfer).toHaveLength(2);
  expect(transfer.find(event => event._id === operationId)).toMatchObject({ type: "transfer", pipeId: source, targetPipeId: target });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 900, spent: 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 1100, contributedFed: 1100 });
  await auth.mutation(edit, { operationId, title: "external", value: -100, date: 1, target: { type: "payByTransfer", paidFrom: target } });
  expect((await t.run(ctx => ctx.db.query("events").collect())).map(event => event._id)).toEqual(transfer.map(event => event._id));
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 1000, spent: 100, pendingFedAdjustment: 100 });
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 900, contributedFed: 1000 });
});

it("removes complete retained history without partially reversing surviving pipes", async () => {
  const { t, auth, operationId, source, target } = await setup("payByTransfer");
  await t.run(ctx => ctx.db.delete("pipes", source));
  const before = await t.run(ctx => ctx.db.get("pipes", target));
  vi.useFakeTimers();
  try {
    await auth.mutation(remove, { operationId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  } finally { vi.useRealTimers(); }
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
});

it("creates and repeats through event-native commands without transaction writes", async () => {
  const { t, auth, source, target } = await setup("expense");
  const result = await auth.mutation(create, { title: " trip ", value: -200, date: 2, from: source, to: target });
  expect(result).toBeNull();
  const events = await t.run(ctx => ctx.db.query("events").collect());
  const repeated = events.find(event => event.type === "transfer")!;
  expect(repeated).toMatchObject({ operationId: repeated._id, title: "trip", value: -200 });
  expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ fed: 800, spent: 100 });
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 1200, contributedFed: 1200 });
});

it("returns a history-invalidation signal only for boiler contributions, not current-only corrections", async () => {
  const { t, auth, target } = await setup("expense");
  expect(await auth.mutation(boiler, { pipeId: target, title: "capital", value: 200, date: 2 })).toBe(true);
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 1200, contributedFed: 1200 });
  const events = await t.run(ctx => ctx.db.query("events").collect());
  expect(await auth.mutation(boiler, { pipeId: target, title: "", value: 0, date: 3, currentFed: 1300 })).toBe(false);
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 1300, contributedFed: 1200 });
  expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
});

it.each([0, 0.5, Infinity, NaN])("rejects invalid edited cents %s atomically", async value => {
  const { t, auth, operationId } = await setup("expense");
  const before = await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }));
  await expect(auth.mutation(edit, { operationId, title: "dinner", value, date: 2 })).rejects.toThrow();
  expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }))).toEqual(before);
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
});

it("blocks native edits and deletions while an involved accounting tree is frozen", async () => {
  const { t, auth, operationId, userId, target } = await setup("transfer");
  await t.run(async ctx => {
    const deletionJobId = await ctx.db.insert("pipeDeletionJobs", { userId, deleteTransactions: false,
      memberPipeIds: [target], initialBalance: 1100, phase: "processingTransactions", memberIndex: 0, role: "from" });
    await ctx.db.patch("pipes", target, { deletionJobId });
  });
  const before = await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }));
  await expect(auth.mutation(edit, { operationId, title: "dinner", value: -200, date: 2 })).rejects.toThrow();
  await expect(auth.mutation(remove, { operationId })).rejects.toThrow();
  expect(await t.run(async ctx => ({ pipes: await ctx.db.query("pipes").collect(), events: await ctx.db.query("events").collect() }))).toEqual(before);
});

it("reads native corrections and removes long histories in bounded, idempotent batches", async () => {
  const { t, auth, operationId, userId } = await setup("expense");
  await t.run(async ctx => {
    for (let i = 0; i < 125; i++) await ctx.db.insert("transactionCorrections", {
      operationId, userId, editedAt: i, previous: { title: "lunch", value: -100, date: 1 }, current: { title: "dinner", value: -100, date: 2 },
    });
  });
  const history = await auth.query(api.operationCorrections.list, { operationId, paginationOpts: { numItems: 100, cursor: null } });
  expect(history.page).toHaveLength(100);
  expect(history.isDone).toBe(false);
  vi.useFakeTimers();
  try {
    await auth.mutation(remove, { operationId });
    await t.mutation(internal.financialOperations.deleteCorrectionsBatch, { operationId });
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toHaveLength(25);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
    await t.mutation(internal.financialOperations.deleteCorrectionsBatch, { operationId });
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  } finally { vi.useRealTimers(); }
});

it.each([false, true])("replaces a missing native source with applyReplacementEffects=%s without losing the surviving payer delta", async applyReplacementEffects => {
  const { t, auth, operationId, userId, source, target } = await setup("payByTransfer");
  const replacement = await t.run(async ctx => {
    await ctx.db.delete("pipes", source);
    return ctx.db.insert("pipes", { userId, name: "Replacement", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 });
  });
  const originalIds = (await t.run(ctx => ctx.db.query("events").collect())).map(event => event._id);
  await auth.mutation(edit, { operationId, primaryPipeId: replacement, applyReplacementEffects, title: "dinner", value: -200, date: 2 });
  expect(await t.run(ctx => ctx.db.get("pipes", replacement))).toMatchObject({ fed: 1000, spent: applyReplacementEffects ? 200 : 0 });
  expect(await t.run(ctx => ctx.db.get("pipes", target))).toMatchObject({ fed: 800, contributedFed: 1000 });
  const entries = await t.run(ctx => ctx.db.query("events").collect());
  expect(entries.map(event => event._id)).toEqual(originalIds);
  expect(entries.find(event => event._id === operationId)).toMatchObject({ pipeId: replacement, targetPipeId: target, value: -200 });
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([
    expect.objectContaining({ operationId, previous: expect.objectContaining({ from: source }), current: expect.objectContaining({ from: replacement }) }),
  ]);
});
