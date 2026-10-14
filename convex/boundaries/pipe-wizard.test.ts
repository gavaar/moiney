// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it, vi, afterEach } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { modules } from "../test.setup";

async function setup() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async ctx => {
    const userId = await ctx.db.insert("users", { username: "alice", email: "alice@example.com", password: "hash" });
    const root = await ctx.db.insert("pipes", { userId, name: "Root", icon: "pipe", priority: 0, capacity: 0, fed: 1000, spent: 0 });
    const source = await ctx.db.insert("pipes", { userId, parentId: root, name: "Source", icon: "pipe", priority: 0, capacity: 100, fed: 0, spent: 0, rule: "instant_settlement" });
    const donor = await ctx.db.insert("pipes", { userId, parentId: root, name: "Reserve", icon: "pipe", priority: 1, capacity: 500, fed: 0, spent: 0 });
    return { userId, root, source, donor };
  });
  return { t, auth: t.withIdentity({ subject: ids.userId }), ...ids };
}

describe("pipe wizard saves", () => {
  afterEach(() => vi.useRealTimers());

  it("atomically changes details, capacity, rule and contingency against the intended rule", async () => {
    const { t, auth, source, donor } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Updated", capacity: -100,
      ruleConfig: { rule: "spend_overflow", capUpdateValue: 200 }, contingencyPipeId: donor });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ name: "Updated", capacity: -100,
      rule: "spend_overflow", capUpdateValue: 200, contingencyPipeId: donor, spent: 0 });
    const pipes = await t.run(ctx => ctx.db.query("pipes").collect());
    expect(pipes.reduce((sum, pipe) => sum + pipe.fed - pipe.spent, 0)).toBe(1000);
  });

  it("rolls back every field when the combined save has an invalid donor", async () => {
    const { t, auth, source, root } = await setup();
    const before = await t.run(ctx => ctx.db.get("pipes", source));
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Updated", capacity: 400,
      ruleConfig: { rule: "spend_overflow" }, contingencyPipeId: root })).rejects.toMatchObject({ data: { code: "INVALID_CONTINGENCY_TARGET" } });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toEqual(before);
  });

  it("applies a backdated cron credit after the entered capacity", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.UTC(2026, 8, 3, 12));
    const { t, auth, source } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, capacity: 300,
      ruleConfig: { rule: "cron", capUpdateValue: 100, interval: 1, unit: "days", starting: Date.UTC(2026, 8, 1, 12) } });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject({ capacity: 500, cronNextDate: Date.UTC(2026, 8, 4, 5) });
  });

  it("creates a child with its contingency atomically", async () => {
    const { t, auth, root, donor } = await setup();
    const child = await auth.mutation(api.pipes.addPipe, { parentId: root, name: "Child", icon: "pipe", priority: 0,
      capacity: 100, contingencyPipeId: donor });
    expect(await t.run(ctx => ctx.db.get("pipes", child))).toMatchObject({ contingencyPipeId: donor });
  });

  it("rolls back child creation and owner resets when the donor is invalid", async () => {
    const { t, auth, source, root } = await setup();
    const before = await t.run(ctx => ctx.db.query("pipes").collect());
    await expect(auth.mutation(api.pipes.addPipe, { parentId: source, name: "Child", icon: "pipe", priority: 0,
      capacity: 100, contingencyPipeId: root })).rejects.toMatchObject({ data: { code: "INVALID_CONTINGENCY_TARGET" } });
    expect(await t.run(ctx => ctx.db.query("pipes").collect())).toEqual(before);
  });

  it("clears incompatible contingency together with the other edits", async () => {
    const { t, auth, source, donor } = await setup();
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, ruleConfig: {}, contingencyPipeId: donor });
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Updated", ruleConfig: { rule: "instant_settlement" }, contingencyPipeId: null });
    const pipe = await t.run(ctx => ctx.db.get("pipes", source));
    expect(pipe).toMatchObject({ name: "Updated", rule: "instant_settlement" });
    expect(pipe).not.toHaveProperty("contingencyPipeId");
  });

  it("preserves a live cron schedule and capacity on details-only edits", async () => {
    const { t, auth, source } = await setup();
    const schedule = { rule: "cron" as const, capacity: 700, capUpdateValue: 200,
      cronNextDate: Date.UTC(2099, 0, 1, 5), cronInterval: { interval: 1, unit: "months" as const } };
    await t.run(ctx => ctx.db.patch("pipes", source, schedule));
    await auth.mutation(api.pipes.updatePipe, { pipeId: source, name: "Updated" });
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toMatchObject(schedule);
  });

  it("requires authentication and ownership for a combined save", async () => {
    const { t, source } = await setup();
    const stranger = await t.run(ctx => ctx.db.insert("users", { username: "bob", email: "bob@example.com", password: "hash" }));
    const command = { pipeId: source, name: "Updated", ruleConfig: { rule: "spend_overflow" as const } };
    await expect(t.mutation(api.pipes.updatePipe, command)).rejects.toThrow();
    await expect(t.withIdentity({ subject: stranger }).mutation(api.pipes.updatePipe, command))
      .rejects.toMatchObject({ data: { code: "PIPE_NOT_FOUND" } });
  });

  it("rejects rules on parents without saving details", async () => {
    const { t, auth, root } = await setup();
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: root, name: "Updated", ruleConfig: { rule: "cron", interval: 1, unit: "days", starting: Date.now() } }))
      .rejects.toMatchObject({ data: { code: "RULE_REQUIRES_LEAF" } });
    expect(await t.run(ctx => ctx.db.get("pipes", root))).toMatchObject({ name: "Root" });
  });

  it("rejects root Self-destruct and invalid combined schedules atomically", async () => {
    const { t, auth, source, root } = await setup();
    const before = await t.run(ctx => ctx.db.get("pipes", source));
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: root, name: "Updated", ruleConfig: { rule: "self_destruct", starting: Date.UTC(2099, 0, 1) } }))
      .rejects.toMatchObject({ data: { code: "SELF_DESTRUCT_REQUIRES_CHILD_LEAF" } });
    await expect(auth.mutation(api.pipes.updatePipe, { pipeId: source, capacity: 500, name: "Updated",
      ruleConfig: { rule: "cron", interval: 0, unit: "days", starting: Date.now() } })).rejects.toThrow();
    expect(await t.run(ctx => ctx.db.get("pipes", source))).toEqual(before);
  });
});
