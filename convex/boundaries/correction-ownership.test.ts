// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

it.each([false, true])("links a correction to the canonical operation (previously linked: %s)", async linked => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Source", icon: "wallet", priority: 0, fed: 1000, spent: 100, capacity: 1000 });
    return { userId, pipeId };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  const transactionId = linked
    ? (await auth.mutation(api.transactions.createTransaction, { from: ids.pipeId, title: "lunch", value: -100, date: 1 })).id
    : await t.run(ctx => ctx.db.insert("transactions", { userId: ids.userId, from: ids.pipeId, kind: "expense", title: "lunch", value: -100, date: 1 }));
  const before = await t.run(ctx => ctx.db.get("transactions", transactionId));
  await auth.mutation(api.transactions.editTransaction, { transactionId, title: "dinner", value: -150, date: 2 });
  const after = await t.run(async ctx => ({
    transaction: await ctx.db.get("transactions", transactionId),
    corrections: await ctx.db.query("transactionCorrections").collect(),
  }));
  expect(after.corrections).toHaveLength(1);
  expect(after.corrections[0]).toMatchObject({ transactionId, operationId: after.transaction!.operationId,
    previous: { title: "lunch", value: -100, date: 1 }, current: { title: "dinner", value: -150, date: 2 } });
  expect(after.corrections[0]).toHaveProperty("operationId");
  if (linked) expect(after.transaction!.operationId).toBe(before!.operationId);
  expect(await auth.query(api.transactions.listTransactionCorrectionsPaginated, {
    transactionId, paginationOpts: { numItems: 10, cursor: null },
  })).toMatchObject({ page: [expect.objectContaining({ correctionId: after.corrections[0]._id })] });
  await auth.mutation(api.transactions.editTransaction, { transactionId, title: "dinner", value: -150, date: 2 });
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toHaveLength(1);
  vi.useFakeTimers();
  try {
    await auth.mutation(api.transactions.deleteTransaction, { transactionId });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
  } finally {
    vi.useRealTimers();
  }
});
