import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addPipe,
  executePipeRuleNow,
  runDueCronRules,
  updatePipe,
  updatePipeRule,
} from "./pipes";
import { computeElapsedIntervals } from "../domain/scheduling";

vi.mock("./lib/auth", () => ({
  requireAuth: vi.fn().mockResolvedValue("user-1"),
}));

function mockDb() {
  const chain = {
    collect: vi.fn().mockResolvedValue([]),
  };
  return {
    get: vi.fn(),
    patch: vi.fn(),
    insert: vi.fn(),
    query: vi.fn(() => ({
      withIndex: vi.fn(() => chain),
    })),
    _chain: chain,
  };
}

function mockCtx() {
  return {
    db: mockDb(),
    auth: { getUserIdentity: vi.fn().mockResolvedValue({ subject: "user-1" }) },
  } as any;
}

const A_PIPE = { _id: "pipe-1", userId: "user-1", capacity: 500 };

describe("updatePipe", () => {
  it("clears an existing description when explicitly requested", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      ...A_PIPE,
      description: "Old description",
    });

    await (updatePipe as any)._handler(ctx, {
      pipeId: "pipe-1",
      description: null,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      description: undefined,
    });
  });
});

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

  it("persists capUpdateValue for spend_overflow", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "spend_overflow",
      capUpdateValue: 25,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "spend_overflow",
      capUpdateValue: 25,
      cronNextDate: undefined,
      cronInterval: undefined,
    });
  });

  it("persists capUpdateValue for any_spend", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(A_PIPE);

    await (updatePipeRule as any)._handler(ctx, {
      pipeId: "pipe-1",
      rule: "any_spend",
      capUpdateValue: -10,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      rule: "any_spend",
      capUpdateValue: -10,
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
    expect(ctx.db._chain.collect).toHaveBeenCalled();
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

    const elapsed = computeElapsedIntervals(starting, 1, "months", Date.now());
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
      capacity: 510,
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
    const calls: any[] = [];
    const q: any = {
      eq: (f: string, v: unknown) => {
        q.eqArgs = [f, v];
        return q;
      },
      gte: (f: string, v: unknown) => {
        q.gteArgs = [f, v];
        return q;
      },
      lt: (f: string, v: unknown) => {
        q.ltArgs = [f, v];
        return q;
      },
    };
    const withIndex = vi.fn((name: string, predicate: any) => {
      q.eqArgs = undefined;
      q.gteArgs = undefined;
      q.ltArgs = undefined;
      predicate(q);
      calls.push({ index: name, ...(q.eqArgs ? { eq: q.eqArgs } : {}), ...(q.ltArgs ? { lt: q.ltArgs } : {}) });
      return {
        collect: vi.fn().mockResolvedValue(name === "by_parentId" ? [] : pipes),
      };
    });
    const query = vi.fn(() => ({ withIndex }));
    return { calls, withIndex, query };
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("queries the by_rule_cronNextDate index for cron pipes due before end of today", async () => {
    const { calls, query } = mockQueryChain([dueToday]);
    const ctx = mockCtx();
    ctx.db.query = query;
    ctx.db.get.mockResolvedValue(dueToday);

    await (runDueCronRules as any)._handler(ctx, { now: NOW });

    const cronCall = calls.find((c) => c.index === "by_rule_cronNextDate");
    expect(cronCall).toBeDefined();
    expect(cronCall.eq).toEqual(["rule", "cron"]);
    expect(cronCall.lt).toEqual(["cronNextDate", END_OF_TODAY]);
  });

  it("runs executePipeRule for each pipe the index returns", async () => {
    const { query } = mockQueryChain([dueToday]);
    const ctx = mockCtx();
    ctx.db.query = query;
    ctx.db.get.mockResolvedValue(dueToday);

    await (runDueCronRules as any)._handler(ctx, { now: NOW });

    expect(ctx.db.patch).toHaveBeenCalledTimes(1);
    expect(ctx.db.patch).toHaveBeenCalledWith("pipe-1", {
      fed: 300,
      spent: 0,
      cronNextDate: Date.UTC(2026, 5, 16, 5),
    });
  });

  it("skips a due rule when its root contains a deleting member", async () => {
    const duePipe = {
      ...dueToday,
      _id: "due-pipe",
      parentId: "root",
    };
    const root = {
      _id: "root",
      userId: "user-1",
      fed: 0,
      spent: 0,
      capacity: 100,
    };
    const deletingChild = {
      _id: "deleting-child",
      parentId: "root",
      deletionJobId: "job-1",
      fed: 0,
      spent: 0,
      capacity: 100,
    };
    let parentId: string | undefined;
    const query = vi.fn(() => ({
      withIndex: vi.fn((name: string, predicate: (q: any) => void) => {
        if (name === "by_parentId") {
          const q = {
            eq: vi.fn((_field: string, value: string) => {
              parentId = value;
              return q;
            }),
          };
          predicate(q);
          return {
            collect: vi.fn().mockResolvedValue(parentId === "root" ? [deletingChild] : []),
          };
        }
        return {
          collect: vi.fn().mockResolvedValue([duePipe]),
        };
      }),
    }));
    const ctx = mockCtx();
    ctx.db.query = query;
    ctx.db.get.mockImplementation((id: string) =>
      id === "due-pipe" ? duePipe : root,
    );

    await (runDueCronRules as any)._handler(ctx, { now: NOW });

    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
});

describe("addPipe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a missing parent without writing", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue(null);

    await expect(
      (addPipe as any)._handler(ctx, {
        name: "Child",
        icon: "pipe",
        priority: 1,
        capacity: 50,
        parentId: "missing-parent",
      }),
    ).rejects.toThrow("Parent pipe not found");

    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });

  it("rejects a foreign parent without writing", async () => {
    const ctx = mockCtx();
    ctx.db.get.mockResolvedValue({
      _id: "foreign-parent",
      userId: "user-2",
    });

    await expect(
      (addPipe as any)._handler(ctx, {
        name: "Child",
        icon: "pipe",
        priority: 1,
        capacity: 50,
        parentId: "foreign-parent",
      }),
    ).rejects.toThrow("Parent pipe not found");

    expect(ctx.db.insert).not.toHaveBeenCalled();
    expect(ctx.db.patch).not.toHaveBeenCalled();
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

    const childId = await (addPipe as any)._handler(ctx, {
      name: "Child",
      icon: "pipe",
      priority: 1,
      capacity: 50,
      parentId: "parent-1",
    });

    expect(childId).toBe("child-1");
    expect(ctx.db.get).toHaveBeenCalledWith("pipes", "parent-1");
    expect(ctx.db.insert).toHaveBeenCalledWith(
      "pipes",
      expect.objectContaining({
        capacity: 50,
      }),
    );
    expect(ctx.db.get.mock.invocationCallOrder[0]).toBeLessThan(
      ctx.db.insert.mock.invocationCallOrder[0],
    );
    const parentPatch = ctx.db.patch.mock.calls.find(
      (call: any[]) => call[0] === "pipes" && call[1] === "parent-1",
    )?.[2];
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
