// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { expect, it } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

it("rejects a structural edit when an unchanged role belongs to a frozen tree", async () => {
  const t = convexTest(schema, modules);
  const state = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      username: "alice",
      email: "alice@example.com",
      password: "hash",
    });
    const sourceRootId = await ctx.db.insert("pipes", {
      userId,
      name: "Source root",
      icon: "wallet",
      priority: 0,
      capacity: 1000,
      fed: 1000,
      spent: 0,
    });
    const sourceId = await ctx.db.insert("pipes", {
      userId,
      parentId: sourceRootId,
      name: "Source",
      icon: "cash",
      priority: 0,
      capacity: 500,
      fed: 500,
      spent: 0,
    });
    const frozenSiblingId = await ctx.db.insert("pipes", {
      userId,
      parentId: sourceRootId,
      name: "Frozen sibling",
      icon: "lock",
      priority: 1,
      capacity: 500,
      fed: 0,
      spent: 0,
    });
    const oldDestinationId = await ctx.db.insert("pipes", {
      userId,
      name: "Old destination",
      icon: "archive",
      priority: 0,
      capacity: 0,
      fed: 500,
      spent: 0,
    });
    const newDestinationId = await ctx.db.insert("pipes", {
      userId,
      name: "New destination",
      icon: "archive",
      priority: 0,
      capacity: 0,
      fed: 0,
      spent: 0,
    });
    const deletionJobId = await ctx.db.insert("pipeDeletionJobs", {
      userId,
      deleteTransactions: false,
      memberPipeIds: [frozenSiblingId],
      initialBalance: 0,
      phase: "processingTransactions",
      memberIndex: 0,
      role: "from",
    });
    await ctx.db.patch("pipes", frozenSiblingId, { deletionJobId });
    const transactionId = await ctx.db.insert("transactions", {
      userId,
      title: "transfer",
      value: -100,
      date: 1000,
      kind: "transfer",
      from: sourceId,
      to: oldDestinationId,
    });
    return { userId, transactionId, newDestinationId };
  });

  await expect(
    t.withIdentity({ subject: state.userId }).mutation(
      api.transactions.editTransaction,
      {
        transactionId: state.transactionId,
        title: "transfer",
        value: -100,
        date: 1000,
        target: { type: "transfer", to: state.newDestinationId },
      },
    ),
  ).rejects.toThrow("Pipe is being deleted");
});
