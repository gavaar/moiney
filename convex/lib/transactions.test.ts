import { describe, expect, it, vi } from "vitest";
import {
  calculatePayByTransferUpdate,
  calculateSpentUpdate,
  getTitleUsagePipeId,
  updateOrCreateTitleUsage,
} from "./transactions";
import { recalculatePipes } from "./pipes";

describe("calculateSpentUpdate", () => {
  it("spent increases by -value when value is negative", () => {
    expect(calculateSpentUpdate(100, -30)).toBe(130);
  });

  it("spent decreases by value when value is positive", () => {
    expect(calculateSpentUpdate(100, 50)).toBe(50);
  });

  it("returns same spent when value is 0", () => {
    expect(calculateSpentUpdate(100, 0)).toBe(100);
  });
});

describe("calculatePayByTransferUpdate", () => {
  it("moves fed from the payer and records an expense on the category", () => {
    expect(calculatePayByTransferUpdate(100, 20, 250, -30)).toEqual({
      fromFed: 130,
      fromSpent: 50,
      paidFromFed: 220,
    });
  });

  it("reverses all effects for a positive refund", () => {
    expect(calculatePayByTransferUpdate(100, 50, 220, 30)).toEqual({
      fromFed: 70,
      fromSpent: 20,
      paidFromFed: 250,
    });
  });

  it("keeps spent cumulative across expenses and a pay-by-transfer refund", () => {
    let spent = calculateSpentUpdate(0, -10);
    spent = calculatePayByTransferUpdate(100, spent, 100, -5).fromSpent;
    spent = calculateSpentUpdate(spent, -8);
    spent = calculatePayByTransferUpdate(100, spent, 100, 3).fromSpent;

    expect(spent).toBe(20);
  });
});

describe("updateOrCreateTitleUsage", () => {
  it("records creation time instead of the transaction's effective date", async () => {
    const existing = { _id: "usage-1", count: 2, lastUsedAt: 100 };
    const chain = {
      withIndex: vi.fn(() => ({
        first: vi.fn().mockResolvedValue(existing),
      })),
    };
    const ctx = {
      db: {
        query: vi.fn(() => chain),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    await updateOrCreateTitleUsage(ctx as any, {
      pipeId: "pipe-1" as any,
      userId: "user-1" as any,
      title: "Coffee",
      now: 5_000,
    });

    expect(ctx.db.patch).toHaveBeenCalledWith("usage-1", {
      count: 3,
      lastUsedAt: 5_000,
    });
  });
});

describe("getTitleUsagePipeId", () => {
  it("uses from for expenses and transfers, otherwise to for feeds", () => {
    expect(getTitleUsagePipeId({ from: "expense", to: undefined })).toBe(
      "expense",
    );
    expect(getTitleUsagePipeId({ from: "source", to: "destination" })).toBe(
      "source",
    );
    expect(getTitleUsagePipeId({ from: undefined, to: "feed" })).toBe("feed");
  });
});

describe("fed transfer via recalculation", () => {
  it("transfers fed between two root pipes: source.fed += value, dest.fed -= value", () => {
    const pipes = [
      {
        _id: "source" as string,
        parentId: undefined as string | undefined,
        priority: 0,
        fed: 500,
      },
      {
        _id: "dest" as string,
        parentId: undefined as string | undefined,
        priority: 0,
        fed: 100,
      },
    ];

    const adjusted = pipes.map((p) => {
      if (p._id === "source") return { ...p, fed: p.fed + -50 };
      if (p._id === "dest") return { ...p, fed: p.fed - -50 };
      return p;
    });

    const result = recalculatePipes(adjusted);
    const map = new Map(result.map((r) => [r._id, r.fed]));

    expect(map.get("source")).toBe(450);
    expect(map.get("dest")).toBe(150);
  });

  it("conserves total fed across all pipes after transfer", () => {
    const pipes = [
      {
        _id: "x" as string,
        parentId: undefined as string | undefined,
        priority: 0,
        fed: 300,
      },
      {
        _id: "y" as string,
        parentId: undefined as string | undefined,
        priority: 0,
        fed: 200,
      },
    ];

    const adjusted = pipes.map((p) => {
      if (p._id === "x") return { ...p, fed: p.fed + -30 };
      if (p._id === "y") return { ...p, fed: p.fed - -30 };
      return p;
    });

    const result = recalculatePipes(adjusted);
    const total = result.reduce((s, r) => s + r.fed, 0);
    expect(total).toBe(500);
  });
});
