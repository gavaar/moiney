import { describe, expect, it } from "vitest";
import { buildPipeTree } from "./pipe-tree";

const catalog = [
  { id: "bank", name: "Bank" },
  { id: "bills", name: "Bills", parentId: "bank" },
  { id: "rent", name: "Rent", parentId: "bills" },
  { id: "food", name: "Food", parentId: "bank" },
  { id: "wallet", name: "Wallet" },
  { id: "cash", name: "Cash", parentId: "wallet" },
];

describe("relevant pipe trees", () => {
  it("connects eligible IDs through their actual ancestry without unrelated branches", () => {
    const result = buildPipeTree(catalog, ["rent"]);
    expect(result.items.map(item => item.id)).toEqual(["bank", "bills", "rent"]);
    expect(result.tree).toEqual([
      { id: "bank", label: "Bank", parentId: undefined, selectable: false },
      { id: "bills", label: "Bills", parentId: "bank", selectable: false },
      { id: "rent", label: "Rent", parentId: "bills", selectable: true },
    ]);
  });

  it("preserves candidate ranking within true ancestry and can prioritize the original root", () => {
    expect(buildPipeTree(catalog, ["cash", "food", "rent"]).items.map(item => item.id))
      .toEqual(["wallet", "cash", "bank", "food", "bills", "rent"]);
    expect(buildPipeTree(catalog, ["cash", "food", "rent"], { preferredPipeId: "rent" }).items[0].id).toBe("bank");
  });

  it("rebases an explicitly scoped subtree without including ancestors or other trees", () => {
    const result = buildPipeTree(catalog, undefined, { rootId: "bills" });
    expect(result.items.map(item => item.id)).toEqual(["bills", "rent"]);
    expect(result.tree[0].parentId).toBeUndefined();
  });

  it("does not turn a pruned parent into a selectable leaf or retain empty structural branches", () => {
    expect(buildPipeTree(catalog, ["food"]).tree.find(node => node.id === "bank")?.selectable).toBe(false);
    expect(buildPipeTree(catalog, []).items).toEqual([]);
    expect(buildPipeTree(catalog, ["bank"]).items.map(item => item.id)).toEqual(["bank"]);
  });

  it("omits missing IDs, incomplete ancestry, and cycles rather than inventing roots", () => {
    const broken = [
      ...catalog,
      { id: "orphan", name: "Orphan", parentId: "missing" },
      { id: "a", name: "A", parentId: "b" },
      { id: "b", name: "B", parentId: "a" },
    ];
    expect(buildPipeTree(broken, ["missing", "orphan", "a", "rent"]).items.map(item => item.id))
      .toEqual(["bank", "bills", "rent"]);
  });
});
