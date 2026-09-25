import { describe, expect, it } from "vitest";
import { groupPipesByRoot } from "./pipeGroups";

const catalog = [
  { id: "budget", name: "Budget", icon: "wallet" },
  { id: "food", parentId: "budget", name: "Food", icon: "food" },
  { id: "travel", parentId: "budget", name: "Travel", icon: "plane" },
  { id: "bank", name: "Bank", icon: "bank" },
  { id: "savings", parentId: "bank", name: "Savings", icon: "cash" },
  { id: "other", name: "Other", icon: "cash" },
];

describe("groupPipesByRoot", () => {
  it("preserves candidate ranking inside groups and sorts groups by their best ranked pipe", () => {
    expect(groupPipesByRoot([catalog[4], catalog[2], catalog[1]], catalog, { expandFirst: true })).toEqual([
      { id: "bank", name: "Bank", icon: "bank", itemIds: ["savings"], initiallyExpanded: true },
      { id: "budget", name: "Budget", icon: "wallet", itemIds: ["travel", "food"], initiallyExpanded: false },
    ]);
  });

  it("prioritizes the original root and retains its selected leaf on repeat and edit", () => {
    expect(groupPipesByRoot([catalog[4], catalog[2], catalog[1]], catalog, { preferredPipeId: "food" })).toEqual([
      { id: "budget", name: "Budget", icon: "wallet", itemIds: ["travel", "food"], initiallyExpanded: true },
      { id: "bank", name: "Bank", icon: "bank", itemIds: ["savings"], initiallyExpanded: false },
    ]);
  });

  it("starts all groups collapsed when a deleted original has no resolvable root", () => {
    expect(groupPipesByRoot([catalog[1], catalog[4]], catalog, { preferredPipeId: "deleted" }))
      .toMatchObject([{ initiallyExpanded: false }, { initiallyExpanded: false }]);
  });

  it("keeps root-only candidates flat, including childless roots", () => {
    expect(groupPipesByRoot([catalog[0], catalog[3], catalog[5]], catalog, { expandFirst: true })).toEqual([]);
    expect(groupPipesByRoot([catalog[4], catalog[3]], catalog, { expandFirst: true })[0].itemIds).toEqual(["savings", "bank"]);
  });
});
