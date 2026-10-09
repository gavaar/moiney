// @vitest-environment edge-runtime
import { readOperations, createAndReadOperation, readOperation } from "./financialFixtures.helpers";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

afterEach(() => vi.useRealTimers());

async function setup() {
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 9, 6));
  const t = convexTest(schema, modules);
  const userId = await t.run(ctx => ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" }));
  return { t, userId, auth: t.withIdentity({ subject: userId }) };
}

describe("Convex boundaries: unified pipe lifecycle events", () => {
  it("creates root and child snapshots with original dates and ancestry but no monetary fields", async () => {
    const { t, auth, userId } = await setup();
    const root = await auth.mutation(api.pipes.addFeed, { name: "Savings", icon: "water-boiler", sourceType: "boiler", initialFed: 1000, contributedFed: 500 });
    const parent = await auth.mutation(api.pipes.addPipe, { parentId: root, name: "Travel", icon: "airplane", priority: 0, capacity: 1000 });
    const child = await auth.mutation(api.pipes.addPipe, { parentId: parent, name: "Madrid", icon: "map", priority: 0, capacity: 1000 });
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(3);
    expect(events.find(event => event.pipeId === root)).toMatchObject({ type: "pipe_creation", userId, name: "Savings", pipeType: "boiler", ancestorIds: [] });
    expect(events.find(event => event.pipeId === child)).toMatchObject({ type: "pipe_creation", name: "Madrid", pipeType: "pipe", ancestorIds: [root, parent], parentName: "Travel", parentIcon: "airplane" });
    for (const event of events) {
      const pipe = await t.run(ctx => ctx.db.get("pipes", event.pipeId));
      expect(event).toMatchObject({ operationId: event._id, occurredAt: pipe!._creationTime });
      expect(event).not.toHaveProperty("value");
      expect(event).not.toHaveProperty("title");
      expect(event).not.toHaveProperty("targetPipeId");
    }
  });

  it("retains distinct creation and deletion operations with final presentation and ancestry, including retries", async () => {
    const { t, auth } = await setup();
    const root = await auth.mutation(api.pipes.addFeed, { name: "Travel", icon: "wallet" });
    const child = await auth.mutation(api.pipes.addPipe, { parentId: root, name: "Madrid", icon: "map", priority: 0, capacity: 0 });
    const originals = await t.run(ctx => ctx.db.query("events").collect());
    await auth.mutation(api.pipes.updatePipe, { pipeId: root, name: "Trips", icon: "airplane" });
    await auth.mutation(api.pipes.updatePipe, { pipeId: child, name: "Madrid trip", icon: "cafe" });
    vi.setSystemTime(Date.UTC(2026, 9, 7));
    const job = await auth.mutation(api.pipes.startPipeDeletion, { pipeId: root, deleteTransactions: false });
    expect(await auth.mutation(api.pipes.startPipeDeletion, { pipeId: root, deleteTransactions: false })).toEqual(job);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(4);
    const creation = events.find(event => event.pipeId === child && event.type === "pipe_creation")!;
    const deletion = events.find(event => event.pipeId === child && event.type === "pipe_deletion")!;
    expect(creation).toMatchObject({ _id: originals.find(event => event.pipeId === child)!._id, name: "Madrid trip", icon: "cafe", ancestorIds: [root], parentName: "Trips", parentIcon: "airplane" });
    expect(deletion).toMatchObject({ name: "Madrid trip", icon: "cafe", ancestorIds: [root], parentName: "Trips", parentIcon: "airplane", occurredAt: Date.UTC(2026, 9, 7), operationId: deletion._id });
    expect(creation.occurredAt).toBe(originals.find(event => event.pipeId === child)!.occurredAt);
    expect(deletion.operationId).not.toBe(creation.operationId);
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
  });

  it.each([false, true])("follows orphan history retention for linked financial events (shared: %s)", async shared => {
    const { t, auth, userId } = await setup();
    const { sourceId, payerId } = await t.run(async ctx => {
      const fields = { userId, icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
      return { sourceId: await ctx.db.insert("pipes", { ...fields, name: "Travel" }), payerId: await ctx.db.insert("pipes", { ...fields, name: "Main" }) };
    });
    const transaction = await createAndReadOperation(t, auth, { title: "hotel", value: -100, date: 1000, from: sourceId, ...(shared ? { paidFrom: payerId } : {}) });
    const financial = await t.run(ctx => ctx.db.query("events").collect());
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId: sourceId, deleteTransactions: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    if (shared) {
      expect(events.filter(event => event.type === "transaction" || event.type === "third_party_transaction")).toEqual(financial);
      expect(events.filter(event => event.type === "pipe_creation" || event.type === "pipe_deletion")).toHaveLength(2);
      expect(events.find(event => event.type === "pipe_creation")).toMatchObject({ pipeId: sourceId, icon: "wallet" });
      expect(await t.run(ctx => ctx.db.get("pipes", payerId))).toMatchObject({ fed: 900 });
    } else {
      expect(events).toEqual([]);
      expect(await t.run(ctx => readOperation(ctx, transaction.id))).toBeNull();
    }
  });

  it("removes an already-recorded creation when orphan history is explicitly discarded", async () => {
    const { t, auth } = await setup();
    const root = await auth.mutation(api.pipes.addFeed, { name: "Empty", icon: "wallet" });
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId: root, deleteTransactions: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
  });

  it("captures an unlinked legacy pipe's creation before removal and credits its signed balance only once", async () => {
    const { t, auth, userId } = await setup();
    const { root, child, createdAt } = await t.run(async ctx => {
      const root = await ctx.db.insert("pipes", { userId, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 });
      const child = await ctx.db.insert("pipes", { userId, parentId: root, name: "Child", icon: "cart", priority: 0, capacity: 1000, fed: 1000, spent: 200, pendingFedAdjustment: 60 });
      return { root, child, createdAt: (await ctx.db.get("pipes", child))!._creationTime };
    });
    vi.setSystemTime(Date.UTC(2026, 9, 7));
    const job = await auth.mutation(api.pipes.startPipeDeletion, { pipeId: child, deleteTransactions: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    expect(events).toHaveLength(2);
    expect(events.find(event => event.type === "pipe_creation")).toMatchObject({ pipeId: child, occurredAt: createdAt, ancestorIds: [root] });
    expect(await t.run(ctx => ctx.db.get("pipes", root))).toMatchObject({ fed: 860 });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.get("pipes", root))).toMatchObject({ fed: 860 });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(events);
  });

  it("purges a retained mirrored operation once its last involved pipe is deleted", async () => {
    const { t, auth, userId } = await setup();
    const { source, payer } = await t.run(async ctx => {
      const fields = { userId, icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
      return { source: await ctx.db.insert("pipes", { ...fields, name: "Trip" }), payer: await ctx.db.insert("pipes", { ...fields, name: "Main" }) };
    });
    const transaction = await createAndReadOperation(t, auth, { title: "hotel", value: -100, date: 1000, from: source, paidFrom: payer });
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId: payer, deleteTransactions: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const payerHistory = await t.run(ctx => ctx.db.query("events").collect());
    expect(payerHistory).toHaveLength(4);
    await auth.mutation(api.pipes.startPipeDeletion, { pipeId: source, deleteTransactions: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => readOperation(ctx, transaction.id))).toBeNull();
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual(payerHistory.filter(event => event.type === "pipe_creation" || event.type === "pipe_deletion"));
  });

  it("captures a surviving parent's presentation at physical removal, not an earlier scheduled batch", async () => {
    const { t, auth } = await setup();
    const root = await auth.mutation(api.pipes.addFeed, { name: "Travel", icon: "wallet" });
    const child = await auth.mutation(api.pipes.addPipe, { parentId: root, name: "Madrid", icon: "map", priority: 0, capacity: 0 });
    const job = await auth.mutation(api.pipes.startPipeDeletion, { pipeId: child, deleteTransactions: false });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => ctx.db.get("pipeDeletionJobs", job.jobId))).toMatchObject({ phase: "readyToFinalize" });
    await auth.mutation(api.pipes.updatePipe, { pipeId: root, name: "Trips", icon: "airplane" });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const events = await t.run(ctx => ctx.db.query("events").collect());
    const childEvents = events.filter(event => event.pipeId === child);
    expect(childEvents).toHaveLength(2);
    for (const event of childEvents) expect(event).toMatchObject({ parentName: "Trips", parentIcon: "airplane" });
  });

  it("removes orphan operations in bounded event pages before finalizing", async () => {
    const { t, auth, userId } = await setup();
    const source = await t.run(ctx => ctx.db.insert("pipes", { userId, name: "Trip", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 }));
    for (let i = 0; i < 51; i++) {
      await auth.mutation(api.financialOperations.create, { title: "hotel", value: -1, date: 1000 + i, from: source });
    }
    const job = await auth.mutation(api.pipes.startPipeDeletion, { pipeId: source, deleteTransactions: true });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId: job.jobId });
    expect(await t.run(ctx => readOperations(ctx))).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toHaveLength(1);
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ deletionJobId: job.jobId });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toBeNull();
  });
});
