import { describe, expect, it } from "vitest";
import { transactionAccountingEffects } from "./accounting";

it("returns transfer effects keyed by transaction role", () => {
  expect(
    transactionAccountingEffects(
      { from: "checking", to: "savings" },
      -50,
    ),
  ).toEqual({
    from: { pipeId: "checking", fedDelta: -50, spentDelta: 0 },
    to: { pipeId: "savings", fedDelta: 50, spentDelta: 0 },
  });
});

describe("transactionAccountingEffects", () => {
  it.each([
    {
      name: "feed",
      transaction: { kind: "feed" as const, to: "income" },
      value: 100,
      expected: {
        to: { pipeId: "income", fedDelta: 100, spentDelta: 0 },
      },
    },
    {
      name: "expense",
      transaction: { kind: "expense" as const, from: "food" },
      value: -30,
      expected: {
        from: { pipeId: "food", fedDelta: 0, spentDelta: 30 },
      },
    },
    {
      name: "transfer",
      transaction: { kind: "transfer" as const, from: "checking", to: "savings" },
      value: -50,
      expected: {
        from: { pipeId: "checking", fedDelta: -50, spentDelta: 0 },
        to: { pipeId: "savings", fedDelta: 50, spentDelta: 0 },
      },
    },
    {
      name: "pay by transfer",
      transaction: {
        kind: "expense" as const,
        from: "food",
        paidFrom: "checking",
      },
      value: -30,
      expected: {
        from: { pipeId: "food", fedDelta: 30, spentDelta: 30 },
        paidFrom: { pipeId: "checking", fedDelta: -30, spentDelta: 0 },
      },
    },
  ])("calculates $name deltas", ({ transaction, value, expected }) => {
    expect(transactionAccountingEffects(transaction, value)).toEqual(expected);
  });

  it("makes an edit delta equivalent to applying the new value", () => {
    const transaction = { kind: "expense" as const, from: "food" };
    const oldValue = -30;
    const newValue = -45;

    const oldEffect = transactionAccountingEffects(transaction, oldValue);
    const editEffect = transactionAccountingEffects(
      transaction,
      newValue - oldValue,
    );
    const newEffect = transactionAccountingEffects(transaction, newValue);

    expect({
      pipeId: editEffect.from!.pipeId,
      fedDelta: oldEffect.from!.fedDelta + editEffect.from!.fedDelta,
      spentDelta: oldEffect.from!.spentDelta + editEffect.from!.spentDelta,
    }).toEqual(newEffect.from);
  });
});
