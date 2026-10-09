// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";
import { createAndReadOperation } from "./financialFixtures.helpers";

it.each([false, true])("links corrections only to the canonical operation (legacy mirror: %s)", async mirrored => {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const pipeId = await ctx.db.insert("pipes", { userId, name: "Source", icon: "wallet", priority: 0, fed: 1000, spent: 100, capacity: 1000 });
    return { userId, pipeId };
  });
  const auth = t.withIdentity({ subject: ids.userId });
  const { operationId } = await createAndReadOperation(t, auth, { from: ids.pipeId, title: "lunch", value: -100, date: 1 });
  if (mirrored) await t.run(ctx => ctx.db.insert("transactions", { operationId, userId: ids.userId, from: ids.pipeId, kind: "expense", title: "lunch", value: -100, date: 1 }));
  const mirrors = await t.run(ctx => ctx.db.query("transactions").collect());
  await auth.mutation(api.financialOperations.edit, { operationId, title: "dinner", value: -150, date: 2 });
  const corrections = await t.run(ctx => ctx.db.query("transactionCorrections").collect());
  expect(corrections).toHaveLength(1);
  expect(corrections[0]).toMatchObject({ operationId,
    previous: { title: "lunch", value: -100, date: 1 }, current: { title: "dinner", value: -150, date: 2 } });
  expect(corrections[0]).not.toHaveProperty("transactionId");
  expect(await auth.query(api.operationCorrections.list, {
    operationId, paginationOpts: { numItems: 10, cursor: null },
  })).toMatchObject({ page: [expect.objectContaining({ correctionId: corrections[0]._id })] });
  await auth.mutation(api.financialOperations.edit, { operationId, title: "dinner", value: -150, date: 2 });
  expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toHaveLength(1);
  vi.useFakeTimers();
  try {
    await auth.mutation(api.financialOperations.remove, { operationId });
    expect(await t.run(ctx => ctx.db.query("events").collect())).toEqual([]);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run(ctx => ctx.db.query("transactionCorrections").collect())).toEqual([]);
    expect(await t.run(ctx => ctx.db.query("transactions").collect())).toEqual(mirrors);
  } finally {
    vi.useRealTimers();
  }
});
