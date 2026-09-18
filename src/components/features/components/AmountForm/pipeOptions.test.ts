import { describe, expect, it } from "vitest";
import { colors } from "@/lib/styles";
import { getTransactionPipeColor, transactionPipeItems } from "./pipeOptions";
import type { PipeModel } from "@features/pipes/data/pipes";

describe("transaction pipe colors", () => {
  it("preserves option order and None while decorating from current catalog balances", () => {
    const pipe: PipeModel = {
      id: "pipe-1" as PipeModel["id"], name: "Wallet", icon: "pipe", priority: 0,
      fed: 1000, spent: 1000, capacity: 2000,
    };
    const none = { id: "", name: "None", icon: "close-circle" };
    const option = { id: pipe.id, name: pipe.name, icon: pipe.icon };
    const catalog = { [pipe.id]: pipe };
    expect(transactionPipeItems([option, none], catalog, true)).toEqual([
      { ...option, color: colors.error, summary: " (10.00 / 20.00)" },
      { ...none, color: colors.muted, summary: "" },
    ]);
    expect(transactionPipeItems([option], { [pipe.id]: { ...pipe, fed: 1001 } })).toEqual([
      { ...option, color: colors.text, summary: "" },
    ]);
  });
  it.each([
    [999, 1000, colors.text],
    [1000, 1000, colors.error],
    [1001, 1000, colors.error],
    [0, 0, colors.error],
    [0, -100, colors.error],
  ])("colors spent %s with fed %s", (spent, fed, color) => {
    expect(getTransactionPipeColor({ spent: Number(spent), fed: Number(fed) })).toBe(color);
  });
  it("keeps None neutral", () => expect(getTransactionPipeColor()).toBe(colors.muted));
});
