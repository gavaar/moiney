import { describe, expect, it } from "vitest";
import { planTransactionDeletion, planTransactionEdit } from "./edit";

describe("planTransactionEdit", () => {
  it("keeps unchanged roles in the affected scope when their net delta is zero", () => {
    expect(
      planTransactionEdit(
        { type: "transfer", from: "source", to: "old" },
        -1000,
        { type: "transfer", from: "source", to: "next" },
        -1000,
      ),
    ).toMatchObject({
      affectedPipeIds: ["source", "old", "next"],
    });
  });

  it("converts an ordinary expense to a transfer with one net delta per pipe", () => {
    expect(
      planTransactionEdit(
        { type: "expense", from: "food" },
        -1000,
        { type: "transfer", from: "food", to: "savings" },
        -1000,
      ).deltas,
    ).toEqual([
      {
        pipeId: "food",
        fedDelta: -1000,
        spentDelta: -1000,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 0,
      },
      {
        pipeId: "savings",
        fedDelta: 1000,
        spentDelta: 0,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 1000,
      },
    ]);
  });

  it("converts an ordinary expense to pay-by-transfer without changing logical spending", () => {
    expect(
      planTransactionEdit(
        { type: "expense", from: "food" },
        -1000,
        { type: "payByTransfer", from: "food", paidFrom: "bank" },
        -1000,
      ).deltas,
    ).toEqual([
      {
        pipeId: "food",
        fedDelta: 0,
        spentDelta: 0,
        pendingFedAdjustmentDelta: 1000,
        contributedFedDelta: 0,
      },
      {
        pipeId: "bank",
        fedDelta: -1000,
        spentDelta: 0,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 0,
      },
    ]);
  });

  it("moves a transfer destination without changing its source", () => {
    expect(
      planTransactionEdit(
        { type: "transfer", from: "source", to: "old" },
        -1000,
        { type: "transfer", from: "source", to: "next" },
        -1000,
      ).deltas,
    ).toEqual([
      {
        pipeId: "old",
        fedDelta: -1000,
        spentDelta: 0,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: -1000,
      },
      {
        pipeId: "next",
        fedDelta: 1000,
        spentDelta: 0,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 1000,
      },
    ]);
  });

  it("uses the value difference for a same-structure edit", () => {
    expect(
      planTransactionEdit(
        { type: "expense", from: "food" },
        -1000,
        { type: "expense", from: "food" },
        -1500,
      ).deltas,
    ).toEqual([
      {
        pipeId: "food",
        fedDelta: 0,
        spentDelta: 500,
        pendingFedAdjustmentDelta: 0,
        contributedFedDelta: 0,
      },
    ]);
  });

  it("conserves signed liquidity and pending adjustments for refunds", () => {
    const { deltas } = planTransactionEdit(
      { type: "expense", from: "food" },
      1000,
      { type: "payByTransfer", from: "food", paidFrom: "bank" },
      1000,
    );

    expect(deltas.reduce((sum, delta) => sum + delta.fedDelta + delta.pendingFedAdjustmentDelta, 0)).toBe(0);
    expect(deltas.find((delta) => delta.pipeId === "food")?.spentDelta).toBe(0);
  });
});

describe("planTransactionDeletion", () => {
  it.each([
    {
      name: "feed",
      structure: { type: "feed", to: "income" } as const,
      value: 1000,
      expected: [
        {
          pipeId: "income",
          fedDelta: -1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: -1000,
        },
      ],
    },
    {
      name: "expense",
      structure: { type: "expense", from: "food" } as const,
      value: -1000,
      expected: [
        {
          pipeId: "food",
          fedDelta: 0,
          spentDelta: -1000,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
      ],
    },
    {
      name: "refund",
      structure: { type: "expense", from: "food" } as const,
      value: 1000,
      expected: [
        {
          pipeId: "food",
          fedDelta: 0,
          spentDelta: 1000,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
      ],
    },
    {
      name: "transfer",
      structure: { type: "transfer", from: "bank", to: "savings" } as const,
      value: -1000,
      expected: [
        {
          pipeId: "bank",
          fedDelta: 1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
        {
          pipeId: "savings",
          fedDelta: -1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: -1000,
        },
      ],
    },
    {
      name: "positive transfer",
      structure: { type: "transfer", from: "bank", to: "savings" } as const,
      value: 1000,
      expected: [
        {
          pipeId: "bank",
          fedDelta: -1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
        {
          pipeId: "savings",
          fedDelta: 1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 1000,
        },
      ],
    },
    {
      name: "pay-by-transfer expense",
      structure: { type: "payByTransfer", from: "food", paidFrom: "bank" } as const,
      value: -1000,
      expected: [
        {
          pipeId: "food",
          fedDelta: 0,
          spentDelta: -1000,
          pendingFedAdjustmentDelta: -1000,
          contributedFedDelta: 0,
        },
        {
          pipeId: "bank",
          fedDelta: 1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
      ],
    },
    {
      name: "pay-by-transfer refund",
      structure: { type: "payByTransfer", from: "food", paidFrom: "bank" } as const,
      value: 1000,
      expected: [
        {
          pipeId: "food",
          fedDelta: 0,
          spentDelta: 1000,
          pendingFedAdjustmentDelta: 1000,
          contributedFedDelta: 0,
        },
        {
          pipeId: "bank",
          fedDelta: -1000,
          spentDelta: 0,
          pendingFedAdjustmentDelta: 0,
          contributedFedDelta: 0,
        },
      ],
    },
  ])("reverses a $name", ({ structure, value, expected }) => {
    expect(planTransactionDeletion(structure, value).deltas).toEqual(expected);
  });
});
