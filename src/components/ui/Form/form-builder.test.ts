import { describe, expect, it, vi } from "vitest";
import { formBuilder } from "./form-builder";

type Draft = { name: string; priority: number; accepted: boolean };

describe("form configuration composition", () => {
  it.each(["select", "select-multiple"] as const)("keeps %s rendering and styling lazy and bound to the original item", type => {
    const { input } = formBuilder<{ owner: string | null; categories: readonly string[] }>();
    const original = { id: "wallet", name: "Wallet", opacity: 0.75 };
    const renderItem = vi.fn((item: typeof original) => item === original ? item.name : "Wrong item");
    const itemStyle = vi.fn((item: typeof original) => ({ opacity: item === original ? item.opacity : 0 }));
    const configuration = { items: [original], renderItem, itemStyle };
    const field = type === "select"
      ? input("owner", { type, ...configuration })
      : input("categories", { type, ...configuration });

    expect(renderItem).not.toHaveBeenCalled();
    expect(itemStyle).not.toHaveBeenCalled();
    if (field.input.type !== "select" && field.input.type !== "select-multiple") throw new Error("Expected selection field");
    const item = field.input.items[0];
    expect(item.id).toBe("wallet");
    expect(field.input.renderItem(item)).toBe("Wallet");
    expect(field.input.itemStyle?.(item)).toEqual({ opacity: 0.75 });
  });

  it("keeps selection styling absent when the caller did not supply it", () => {
    const { input } = formBuilder<{ owner: string | null }>();
    const field = input("owner", { type: "select", items: [{ id: "wallet", name: "Wallet" }], renderItem: item => item.name });
    expect(field.input.itemStyle).toBeUndefined();
  });

  it("composes pages and rows with shared defaults, explicit overrides, and field metadata", () => {
    const { form, page, row, input } = formBuilder<Draft>({ defaults: { disabled: true } });
    const reveal = { label: "More", expanded: false, onReveal: () => {} };

    expect(form(page(
      row(input("name", { label: "Name" }, { description: "Help", reveal })),
      row(
        input("priority", { type: "number", disabled: false }),
        input("accepted", { type: "checkbox" }),
      ),
    ))).toEqual([
      {
        key: 0,
        rows: [
          [{ key: "name", input: { label: "Name", disabled: true }, description: "Help", reveal }],
          [
            { key: "priority", input: { type: "number", disabled: false } },
            { key: "accepted", input: { type: "checkbox", disabled: true } },
          ],
        ],
      },
    ]);
  });

  it("omits conditional fragments and numbers pages from each explicit cursor", () => {
    const { form, page, row, input } = formBuilder<Draft>();
    const nameRow = row(null, input("name", {}), false, undefined);
    const priorityRow = row(input("priority", { type: "number" }));
    const acceptedRow = row(input("accepted", { type: "checkbox" }));
    const pages = form(null, page(1, null, nameRow, false), false, page(priorityRow), page(10, acceptedRow), undefined);

    expect(pages.map(page => page.key)).toEqual([1, 2, 10]);
    expect(pages[0].rows).toEqual([nameRow]);
    // Reusing a fragment does not retain a counter from a previous composition.
    expect(form(page(nameRow), page(priorityRow)).map(page => page.key)).toEqual([0, 1]);
    expect(form(null, false, undefined)).toEqual([]);
  });

  it("rejects duplicate page identities, including automatic collisions", () => {
    const { form, page, row, input } = formBuilder<Draft>();
    const nameRow = row(input("name", {}));
    const priorityRow = row(input("priority", { type: "number" }));
    expect(() => form(page(nameRow), page(0, priorityRow))).toThrow("Duplicate page key: 0");
    expect(() => form(page(1, nameRow), page(0, priorityRow), page(row(input("accepted", { type: "checkbox" }))))).toThrow("Duplicate page key: 1");
  });

  it("rejects duplicate field keys within rows, between rows, and across pages", () => {
    const { form, page, row, input } = formBuilder<Draft>();
    const name = input("name", {});
    const nameRow = row(name);
    expect(() => form(page(row(name, name)))).toThrow("Duplicate field key: name");
    expect(() => form(page(nameRow, nameRow))).toThrow("Duplicate field key: name");
    expect(() => form(page(nameRow), page(nameRow))).toThrow("Duplicate field key: name");
  });

  it("rejects empty pages and rows after conditional omissions at finalization", () => {
    const { form, page, row } = formBuilder<Draft>();
    const emptyPage = page(null, false, undefined);
    const emptyRow = row(null, false, undefined);
    expect(() => form(emptyPage)).toThrow("Empty page: 0");
    expect(() => form(page(emptyRow))).toThrow("Empty row in page: 0");
  });
});
