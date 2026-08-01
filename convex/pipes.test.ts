import { beforeEach, describe, expect, it, vi } from "vitest";
import { addPipe, updatePipeRule, executePipeRuleNow, runDueCronRules } from "./pipes";
import { computeElapsedIntervals } from "./lib/pipes";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue("user-1"),
}));

function mockDb() {
  return {
    get: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(),
  };
}

function mockCtx() {
  return {
    db: mockDb(),
    auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: "user-1" }) },
  } as any;
}

const A_PIPE = { _id: "pipe-1", userId: "user-1", capacity: 500 };

describe("updatePipeRule", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the rule and all rule options when rule is null", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: null,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: undefined,
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    });
  });

  it("clears the rule and all rule options when rule is undefined", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: undefined,
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    });
  });

  it("sets spend_overflow and clears rule options", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "spend_overflow",
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "spend_overflow",
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    });
  });

  it("sets any_spend and clears rule options", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "any_spend",
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "any_spend",
      capUpdateValue: undefined,
      cronNextDate: undefined,
      cronInterval: undefined,
    });
  });

  it("sets a cron rule with interval, computed next date, and capUpdateValue", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);
    const starting = Date.UTC(2099, 8, 15, 8, 30);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "cron",
      interval: 30,
      unit: "days",
      starting,
      capUpdateValue: 500,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "cron",
      capUpdateValue: 500,
      capacity: 500,
      cronNextDate: Date.UTC(2099, 8, 15, 5),
      cronInterval: { interval: 30, unit: "days" },
    });
  });

  it("sets a cron rule without capUpdateValue", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);
    const starting = Date.UTC(2099, 8, 15, 8, 30);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "cron",
      interval: 30,
      unit: "days",
      starting,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "cron",
      capUpdateValue: undefined,
      cronNextDate: Date.UTC(2099, 8, 15, 5),
      cronInterval: { interval: 30, unit: "days" },
    });
  });

  it("throws when cron interval, unit, or starting is missing", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await expect(
      (updatePipeRule as any)._handler(ctx, {
        pipeId: "pipe-1",
        rule: "cron",
      }),
    ).rejects.toThrow("Cron rule requires interval, unit, and starting");
  });

  it("throws when the pipe is not found", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(null);

    await expect(
      (updatePipeRule as any)._handler(ctx, {
        pipeId: "pipe-1",
        rule: null,
      }),
    ).rejects.toThrow("Pipe not found");
  });

  it("throws when the user does not own the pipe", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ _id: "pipe-1", userId: "other-user" });

    await expect(
      (updatePipeRule as any)._handler(ctx, {
        pipeId: "pipe-1",
        rule: "cron",
        interval: 1,
        unit: "days",
        starting: Date.UTC(2099, 0, 1),
      }),
    ).rejects.toThrow("Not authorized");
  });

  it("credits missed intervals to capacity when started is in the past", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ _id: "pipe-1", userId: "user-1", capacity: 100 });
    const starting = Date.UTC(2026, 0, 15);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "cron",
      interval: 1,
      unit: "months",
      starting,
      capUpdateValue: 50,
    });

    const elapsed = computeElapsedIntervals(starting, 1, "months");
    expect(ctx.db.patch).toHaveBeenCalledWith(
      "pipe-1",
      expect.objectContaining({
        capacity: 100 + elapsed * 50,
      }),
    );
  });

  it("credits capacity again when the same cron rule is saved again", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ _id: "pipe-1", userId: "user-1", capacity: 0 });
    const args = {
      pipeId: "pipe-1",
      rule: "cron",
      interval: 1,
      unit: "months",
      starting: Date.UTC(2026, 0, 15),
      capUpdateValue: 50,
    };

    await (updatePipeRule as any)._handler(ctx, args);
    const first = ctx.db.patch.mock.calls[0][1].capacity;

    ctx.db.get.mockResolvedValue({ _id: "pipe-1", userId: "user-1", capacity: first });
    await (updatePipeRule as any)._handler(ctx, args);

    expect(ctx.db.patch).toHaveBeenCalledTimes(2);
    expect(ctx.db.patch.mock.calls[1][1].capacity).toBe(first * 2);
  });

  it("does not credit capacity when capUpdateValue is not provided", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "cron",
      interval: 1,
      unit: "months",
      starting: Date.UTC(2026, 0, 15),
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "cron",
      capUpdateValue: undefined,
      cronNextDate: expect.any(Number),
      cronInterval: { interval: 1, unit: "months" },
    });
  });
});

describe("executePipeRuleNow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the pipe is not found", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(null);

    await expect(
      (executePipeRuleNow as any)._handler(ctx, { pipeId: "pipe-1" }),
    ).rejects.toThrow("Pipe not found");
  });

  it("throws when the user does not own the pipe", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({ _id: "pipe-1", userId: "other-user" });

    await expect(
      (executePipeRuleNow as any)._handler(ctx, { pipeId: "pipe-1" }),
    ).rejects.toThrow("Not authorized");
  });

  it("consolidates fed/spent and tops up capacity via the rule executor", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      _id: "pipe-1",
      userId: "user-1",
      fed: 100,
      spent: 40,
      capacity: 500,
      capUpdateValue: 50,
    });

    await (executePipeRuleNow as any)._handler(ctx, { pipeId: "pipe-1" });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 60,
      spent: 0,
      capacity: 110,
    });
  });

  it("consolidates without touching capacity when capUpdateValue is not set", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      _id: "pipe-1",
      userId: "user-1",
      fed: 100,
      spent: 40,
      capacity: 500,
    });

    await (executePipeRuleNow as any)._handler(ctx, { pipeId: "pipe-1" });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 60,
      spent: 0,
    });
  });

  it("advances cronNextDate for a cron pipe", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      _id: "pipe-1",
      userId: "user-1",
      rule: "cron",
      fed: 0,
      spent: 0,
      capacity: 100,
      capUpdateValue: 10,
      cronInterval: { interval: 1, unit: "days" },
      cronNextDate: Date.UTC(2020, 0, 1, 5),
    });

    await (executePipeRuleNow as any)._handler(ctx, { pipeId: "pipe-1" });

    expect(ctx.db.patch).toHaveBeenCalledWith(
      "pipe-1",
      expect.objectContaining({
        cronNextDate: expect.any(Number),
      }),
    );
    const patch = ctx.db.patch.mock.calls[0][1];
    expect(patch.cronNextDate).toBeGreaterThan(Date.now());
    expect(patch.cronNextDate % (24 * 60 * 60 * 1000)).toBe(
      Date.UTC(2020, 0, 1, 5) % (24 * 60 * 60 * 1000),
    );
  });
});

describe("runDueCronRules", () => {
  const NOW = Date.UTC(2026, 5, 15, 13);
  const END_OF_TODAY = Date.UTC(2026, 5, 16);

  const dueToday = {
    _id: "pipe-1",
    userId: "user-1",
    rule: "cron" as const,
    cronNextDate: Date.UTC(2026, 5, 15, 5),
    cronInterval: { interval: 1, unit: "days" as const },
    fed: 500,
    spent: 200,
    capacity: 1000,
  };

  function mockQueryChain(pipes: any[]) {
    const bounds: any = {};
    const q = {
      eq: (f: string, v: unknown) => {
        bounds.eq = [f, v];
        return q;
      },
      gte: (f: string, v: unknown) => {
        bounds.gte = [f, v];
        return q;
      },
      lt: (f: string, v: unknown) => {
        bounds.lt = [f, v];
        return q;
      },
    };
    const withIndex = vi.fn((_name: string, predicate: any) => {
      predicate(q);
      return { collect: vi.fn().mockResolvedValue(pipes) };
    });
    const query = vi.fn(() => ({ withIndex }));
    return { bounds, withIndex, query };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the by_rule_cronNextDate index for cron pipes due before end of today", async () => {
    const { bounds, withIndex, query } = mockQueryChain([dueToday]);
    const ctx = mockCtx();
    ctx.db.query = query;

    await (runDueCronRules as any)._handler(ctx, { now: NOW });

    expect(withIndex).toHaveBeenCalledWith(
      "by_rule_cronNextDate",
      expect.any(Function),
    );
    expect(bounds.eq).toEqual(["rule", "cron"]);
    expect(bounds.lt).toEqual(["cronNextDate", END_OF_TODAY]);
  });

  it("runs executePipeRule for each pipe the index returns", async () => {
    const { query } = mockQueryChain([dueToday]);
    const ctx = mockCtx();
    ctx.db.query = query;

    await (runDueCronRules as any)._handler(ctx, { now: NOW });

    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
      cronNextDate: Date.UTC(2026, 5, 16, 5),
    });
  });
});

describe("addPipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("clears the parent's rules when adding a child pipe", async () => {
    const parentPipe = {
      _id: "parent-1",
      userId: "user-1",
      name: "Parent",
      icon: "home-outline",
      capacity: 100,
      spent: 20,
      fed: 50,
      rule: "any_spend",
      capUpdateValue: 10,
      cronNextDate: 1234,
      cronInterval: { interval: 1, unit: "days" },
    };
    const chain = {
      withIndex: vi.fn(() => chain),
      collect: vi.fn().mockResolvedValue([parentPipe]),
    };
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(parentPipe);
    ctx.db.insert.mockResolvedValue("child-1");
    ctx.db.query.mockReturnValue(chain);

    await (addPipe as any)._handler(ctx, {
      name: "Child",
      icon: "pipe",
      priority: 1,
      capacity: 50,
      parentId: "parent-1",
    });

    const parentPatch = ctx.db.patch.mock.calls.find(
      (call: any[]) => call[0] === "parent-1",
    )?.[1];
    expect(Object.keys(parentPatch)).toEqual([
      "capacity",
      "spent",
      "rule",
      "capUpdateValue",
      "cronNextDate",
      "cronInterval",
    ]);
    expect(parentPatch).toMatchObject({ capacity: 0, spent: 0 });
  });
});
