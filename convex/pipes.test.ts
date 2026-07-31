import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePipeRule } from "./pipes";
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
      cronNextDate: Date.UTC(2099, 8, 15, 12),
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
      cronNextDate: Date.UTC(2099, 8, 15, 12),
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
