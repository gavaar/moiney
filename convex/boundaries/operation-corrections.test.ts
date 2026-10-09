// @vitest-environment edge-runtime
import { createAndReadOperation } from "./financialFixtures.helpers";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

const listCorrections = makeFunctionReference<"query">("operationCorrections:list");

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const otherId = await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" });
    const fields = { userId, name: "Wallet", icon: "wallet", priority: 0, capacity: 1000, fed: 1000, spent: 0 };
    return { userId, otherId, source: await ctx.db.insert("pipes", fields), payer: await ctx.db.insert("pipes", fields) };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  const { operationId } = await createAndReadOperation(t, auth, { from: ids.source, paidFrom: ids.payer, title: "lunch", value: -100, date: 1 });
  await auth.mutation(api.financialOperations.edit, { operationId, title: "dinner", value: -150, date: 2 });
  await auth.mutation(api.financialOperations.edit, { operationId, title: "hotel", value: -200, date: 3 });
  return { t, auth, operationId, ...ids };
}

it("preserves Edited metadata and paginated correction history without the legacy transaction row", async () => {
  const { t, auth, operationId, payer } = await setup();
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  const first = await auth.query(listCorrections, { operationId, paginationOpts: { numItems: 1, cursor: null } });
  expect(first).toMatchObject({ isDone: false, page: [{ correctionId: corrections[1]._id, previous: { title: "dinner" }, current: { title: "hotel" } }] });
  expect(first.page[0]).not.toHaveProperty("transactionId");
  expect(first.page[0]).not.toHaveProperty("userId");
  const second = await auth.query(listCorrections, { operationId, paginationOpts: { numItems: 1, cursor: first.continueCursor } });
  expect(second).toMatchObject({ isDone: true, page: [{ correctionId: corrections[0]._id }] });
  expect(await auth.query(api.events.latest, { pipeId: payer })).toEqual([
    expect.objectContaining({ operationId, editedAt: corrections[1].editedAt }),
  ]);
  expect((await auth.query(api.events.list, {})).events.every(event => "editedAt" in event && event.editedAt === corrections[1].editedAt)).toBe(true);
});

it("authorizes correction reads through the complete canonical operation", async () => {
  const { t, auth, operationId, otherId } = await setup();
  const args = { operationId, paginationOpts: { numItems: 20, cursor: null } };
  await expect(t.query(listCorrections, args)).rejects.toThrow("Not authenticated");
  await expect(t.withIdentity({ subject: otherId }).query(listCorrections, args)).rejects.toThrow("OPERATION_NOT_FOUND");
  const mirror = await t.run(async ctx => (await ctx.db.query("events").withIndex("by_operationId", q => q.eq("operationId", operationId)).collect()).find(event => event._id !== operationId)!);
  await expect(auth.query(listCorrections, { ...args, operationId: mirror._id })).rejects.toThrow("OPERATION_NOT_FOUND");
  await t.run(ctx => ctx.db.delete("events", mirror._id));
  await expect(auth.query(listCorrections, args)).rejects.toThrow("counterpart");
});

it("rejects correction ownership corruption rather than exposing another account's snapshots or edit timestamp", async () => {
  const { t, auth, operationId, otherId } = await setup();
  await t.run(async ctx => {
    const last = await ctx.db.query("transactionCorrections")
      .withIndex("by_operationId", q => q.eq("operationId", operationId)).order("desc").first();
    await ctx.db.patch("transactionCorrections", last!._id, { userId: otherId });
  });
  await expect(auth.query(listCorrections, { operationId, paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("CORRECTION_OWNER_MISMATCH");
  await expect(auth.query(api.events.latest, {})).rejects.toThrow("CORRECTION_OWNER_MISMATCH");
});

it.each([0, -1, 0.5, 101])("rejects an invalid correction page size %s", async numItems => {
  const { auth, operationId } = await setup();
  await expect(auth.query(listCorrections, { operationId, paginationOpts: { numItems, cursor: null } })).rejects.toThrow("INVALID_CORRECTION_LIMIT");
});

it("bounds rows read even when reactive pagination supplies a wider end-cursor window", async () => {
  const { t, auth, operationId } = await setup();
  await t.run(async ctx => {
    const example = (await ctx.db.query("transactionCorrections").first())!;
    for (let i = 0; i < 120; i++) await ctx.db.insert("transactionCorrections", {
      userId: example.userId, operationId,
      editedAt: example.editedAt + i + 1, previous: example.previous, current: example.current,
    });
  });
  const first = await auth.query(listCorrections, { operationId, paginationOpts: { numItems: 100, cursor: null } });
  const second = await auth.query(listCorrections, { operationId, paginationOpts: { numItems: 10, cursor: first.continueCursor } });
  const window = await auth.query(listCorrections, { operationId, paginationOpts: { numItems: 1, cursor: null, endCursor: second.continueCursor } });
  expect(window.page.length).toBeLessThanOrEqual(100);
  expect(window.isDone).toBe(false);
});

it("rejects lifecycle operations and treats a deleted canonical event as unavailable", async () => {
  const { t, auth, operationId, source, userId } = await setup();
  const lifecycleId = await t.run(async ctx => {
    const id = await ctx.db.insert("events", { userId, pipeId: source, type: "pipe_creation", name: "Wallet", icon: "wallet",
      ancestorIds: [], pipeType: "feed", occurredAt: 1 });
    await ctx.db.patch("events", id, { operationId: id });
    return id;
  });
  await expect(auth.query(listCorrections, { operationId: lifecycleId, paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("OPERATION_NOT_FOUND");
  await t.run(ctx => ctx.db.delete("events", operationId));
  await expect(auth.query(listCorrections, { operationId, paginationOpts: { numItems: 20, cursor: null } })).rejects.toThrow("OPERATION_NOT_FOUND");
});
