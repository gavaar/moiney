import { describe, expect, it } from "vitest";
import { formBuilder } from "./form-builder";

type Draft = { name: string; priority: number; accepted: boolean };

describe("form configuration composition", () => {
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
