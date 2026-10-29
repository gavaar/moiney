// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import schema from "../schema";
import { modules } from "../test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Root", icon: "pipe", priority: 0, capacity: 0, fed: 0, spent: 0 });
    const source = await ctx.db.insert("pipes", { userId, parentId: root, name: "Source", icon: "pipe", priority: 0, capacity: 100, fed: 0, spent: 0 });
    const donor = await ctx.db.insert("pipes", { userId, parentId: root, name: "Reserve", icon: "pipe", priority: 1, capacity: 100, fed: 0, spent: 0 });
    return { userId, root, source, donor };
  });
  return { t, auth: t.withIdentity({ subject: ids.userId }), ...ids };
}

describe("contingency configuration boundaries", () => {
  it("sets, returns, preserves on unrelated edits, and explicitly clears a donor without moving money", async () => {
    const { t, auth, source, donor } = await setup();
    const before = await t.run(ctx => ctx.db.get("pipes", source));
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor });
    expect(await auth.query(api.pipes.getPipes, {})).toContainEqual(expect.objectContaining({ _id: source, contingencyPipeId: donor }));
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Renamed" });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ contingencyPipeId: donor, fed: before!.fed, spent: before!.spent });
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: null });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).not.toHaveProperty("contingencyPipeId");
  });

  it.each(["self", "ancestor", "other-tree", "foreign", "missing", "non-leaf", "chain"] as const)("rejects a %s donor atomically", async kind => {
    const { t, auth, userId, source, donor, root } = await setup();
    const target = await t.run(async ctx => {
      if (kind === "self") return source;
      if (kind === "ancestor") return root;
      if (kind === "non-leaf") {
        await ctx.db.insert("pipes", { userId, parentId: donor, name: "Child", icon: "pipe", priority: 0, capacity: 0, fed: 0, spent: 0 });
        return donor;
      }
      if (kind === "chain") {
        await ctx.db.patch("pipes", donor, { contingencyPipeId: source });
        return donor;
      }
      if (kind === "missing") {
        await ctx.db.delete("pipes", donor);
        return donor;
      }
      const owner = kind === "foreign"
        ? await ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" }) : userId;
      return await ctx.db.insert("pipes", {
        userId: owner,
        parentId: kind === "foreign" ? root : undefined,
        name: "Invalid",
        icon: "pipe",
        priority: 0,
        capacity: 0,
        fed: 0,
        spent: 0
      });
    });
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Should not save", contingencyPipeId: target }))
      .rejects.toMatchObject({ data: { code: "INVALID_CONTINGENCY_TARGET" } });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ name: "Source" });
  });

  it("requires source ownership and authentication even for a clear command", async () => {
    const { t, source } = await setup();
    const stranger = await t.run(ctx => ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" }));
    await expect(t.withIdentity({ subject: stranger }).mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: null }))
      .rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
    await expect(t.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: null })).rejects.toThrow();
  });

  it.each(["instant_settlement"] satisfies Doc<"pipes">["rule"][])("rejects a %s source", async rule => {
    const { t, auth, source, donor } = await setup();
    await t.run(ctx => ctx.db.patch("pipes", source, { rule }));
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor }))
      .rejects.toMatchObject({ data: { code: "INVALID_CONTINGENCY_TARGET" } });
  });

  it("allows shared donors but rejects turning an existing donor into a source", async () => {
    const { t, auth, userId, root, source, donor } = await setup();
    const second = await t.run(ctx => ctx.db.insert("pipes", { userId, parentId: root, name: "Second", icon: "pipe", priority: 2, capacity: 0, fed: 0, spent: 0 }));
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor });
    await auth.mutation(api.pipes.updatePipe, { pipeId: second, contingencyPipeId: donor });
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: donor, contingencyPipeId: second }))
      .rejects.toMatchObject({ data: { code: "INVALID_CONTINGENCY_TARGET" } });
  });

  it.each(["source", "donor", "ancestor"] as const)("rejects a frozen %s", async role => {
    const { t, auth, userId, root, source, donor } = await setup();
    const frozen = role === "source" ? source : role === "donor" ? donor : root;
    await t.run(async ctx => {
      const job = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [frozen],
        initialBalance: 0,
        historySource: "events",
        phase: "processingTransactions",
        memberIndex: 0
      });
      await ctx.db.patch("pipes", frozen, { deletionJobId: job });
    });
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.get("pipes", source))).not.toHaveProperty("contingencyPipeId");
  });

  it.each(["instant_settlement", "self_destruct"] as const)("updates contingency consistently when switching to %s", async rule => {
    const { t, auth, source, donor } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor });
    await auth.mutation(api.pipes.updatePipeRule, {
      pipeId: source,
      rule,
      ...(rule === "self_destruct" ? { starting: Date.now() + 7 * 86400000 } : {})
    });
    const updated = await t.run(ctx => ctx.db.get("pipes", source));
    if (rule === "instant_settlement") expect(updated).not.toHaveProperty("contingencyPipeId");
    else expect(updated).toHaveProperty("contingencyPipeId", donor);
  });

  it.each(["source", "donor"] as const)("clears invalid selections when a %s gains a child", async role => {
    const { t, auth, source, donor } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor });
    await auth.mutation(api.pipes.addPipe, {
      parentId: role === "source" ? source : donor,
      name: "New child",
      icon: "pipe",
      priority: 0,
      capacity: 0
    });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).not.toHaveProperty("contingencyPipeId");
  });

  it("clears surviving references when donor deletion finalizes, including retries", async () => {
    const { t, auth, userId, source, donor } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, contingencyPipeId: donor });
    const jobId = await t.run(async ctx => {
      const jobId = await ctx.db.insert("pipeDeletionJobs", {
        userId,
        deleteTransactions: false,
        memberPipeIds: [donor],
        initialBalance: 0,
        historySource: "events",
        phase: "readyToFinalize",
        memberIndex: 0
      });
      await ctx.db.patch("pipes", donor, { deletionJobId: jobId });
      return jobId;
    });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId });
    await t.mutation(internal.pipes.processPipeDeletion, { jobId });
    expect(await t.run(ctx => ctx.db.get("pipes", donor))).toBeNull();
    expect(await t.run(ctx => ctx.db.get("pipes", source))).not.toHaveProperty("contingencyPipeId");
  });
});
