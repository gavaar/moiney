// @vitest-environment jsdom
import { useState } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { Form, type FormProps, type FormRow } from ".";
import { Button } from "@ui/Button";

type Values = { name: string; count: number; accepted: boolean };
const fields: FormRow<Values> = [
  { key: "name", input: { label: "Name", validator: (value) => value.length < 2 ? "Too short" : undefined }, description: "Your display name" },
  { key: "count", input: { type: "number", label: "Count", step: 2 } },
  { key: "accepted", input: { type: "checkbox", label: "Accepted", validator: (value) => value ? undefined : "Required" } },
];

const singlePage: FormProps<Values>["pages"] = [{ key: 0, rows: fields.map(field => [field]) }];

function Controlled({ pages = singlePage }: { pages?: FormProps<Values>["pages"] }) {
  const [value, setValue] = useState<Values>({ name: "", count: 2, accepted: true });
  return <Form header={{ title: "Custom header" }} pages={pages} value={value} onChange={setValue} />;
}

describe("Form controlled fields", () => {
  it.each([0, -1, NaN, Infinity, -Infinity])("rejects invalid field growth %s", grow => {
    const pages = [{ key: 0, rows: [[{ ...fields[0], grow }]] }];
    expect(() => render(<Controlled pages={pages} />))
      .toThrow('Invalid grow for field "name": expected a positive finite number');
  });

  it("renders header badges and a distinct accessible title", () => {
    render(<Form pages={singlePage} value={{ name: "Ada", count: 2, accepted: true }} onChange={() => {}}
      header={{ title: "Groceries", icon: "pipe", accessibilityLabel: "Edit Groceries", badge: { label: "edit", icon: "pencil-outline" } }} />);
    expect(screen.getByRole("heading", { name: "Edit Groceries" })).toBeTruthy();
    expect(screen.getByText("Groceries")).toBeTruthy();
    expect(screen.getByText("edit")).toBeTruthy();
  });

  it("reveals optional fields without changing values and clears hidden error indicators on reset", async () => {
    const onChange = vi.fn();
    function Example({ disabled = false }: { disabled?: boolean }) {
      const [expanded, setExpanded] = useState(false);
      return <>
        <button onClick={() => setExpanded(false)}>Reset disclosure</button>
        <Form pages={[
          {
            key: 0,
            rows: [
              [{ key: "name", input: { label: "Name" } }],
              [
                {
                  key: "optional",
                  input: { label: "Optional", disabled, validator: () => "Invalid optional" },
                  reveal: { label: "Show optional", expanded, onReveal: () => setExpanded(true) }
                }
              ]
            ]
          },
          { key: 1, rows: [[{ key: "last", input: { label: "Last" } }]] },
        ]} value={{ name: "Name", optional: "Retained", last: "" }} onChange={onChange} />
      </>;
    }
    const { rerender } = render(<Example disabled />);
    expect(screen.queryByRole("textbox", { name: "Optional" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show optional" }));
    expect(screen.queryByRole("textbox", { name: "Optional" })).toBeNull();
    rerender(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Show optional" }));
    expect(screen.getByDisplayValue("Retained")).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("textbox", { name: "Optional" }));
    expect(screen.getByLabelText("Step 1 of 2, has errors")).toBeTruthy();
    await userEvent.click(screen.getByText("Reset disclosure"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByLabelText("Step 1 of 2")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show optional" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByDisplayValue("Retained")).toBeTruthy();
  });

  it("renders a configured header and description without single-step navigation", () => {
    render(<Controlled />);
    expect(screen.getByText("Custom header")).toBeTruthy();
    expect(screen.getByText("Your display name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([
    ["text", "Your display name"],
    ["JSX", <Text key="description">Your display name</Text>],
  ])("replaces a %s description with its field error and restores it when fixed", (_kind, description) => {
    render(<Controlled pages={[{ key: 0, rows: [[{ ...fields[0], description }, fields[1]]] }]} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(screen.getByText("Your display name")).toBeTruthy();
    fireEvent.blur(name);
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    expect(screen.queryByText("Your display name")).toBeNull();
    expect(screen.getByRole("textbox", { name: "Count" }).getAttribute("value")).toBe("2");
    fireEvent.change(name, { target: { value: "Ada" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Your display name")).toBeTruthy();
  });

  it.each([
    { supportingText: undefined, description: "Field hint", expected: "Field hint" },
    { supportingText: "Explicit hint", description: "Field hint", expected: "Explicit hint" },
    { supportingText: null, description: "Field hint", expected: undefined },
    { supportingText: "", description: "Field hint", expected: undefined },
    { supportingText: undefined, description: undefined, expected: "3 / 10" },
    { supportingText: undefined, description: null, expected: undefined },
  ])("resolves a single footer from $supportingText / $description", ({ supportingText, description, expected }) => {
    const field = {
      key: "name" as const,
      input: { label: "Name", maxLength: 10, supportingText },
      description,
    };
    render(<Form pages={[{ key: 0, rows: [[field]] }]} value={{ name: "Ada" }} onChange={() => {}} />);
    for (const message of ["Field hint", "Explicit hint", "3 / 10"]) {
      expect(screen.queryByText(message) !== null).toBe(message === expected);
    }
  });

  it("emits all and only declared keys and uses externally controlled values", () => {
    const onChange = vi.fn();
    const value = { name: "Old", count: 2, accepted: false, extra: "omit" };
    const { rerender } = render(<Form pages={singlePage} value={value} onChange={(next) => {
      expectTypeOf(next).toEqualTypeOf<Values>();
      onChange(next);
    }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "New" } });
    expect(onChange).toHaveBeenLastCalledWith({ name: "New", count: 2, accepted: false });
    rerender(<Form pages={singlePage} value={{ ...value, name: "Parent update" }} onChange={onChange} />);
    expect(screen.getByDisplayValue("Parent update")).toBeTruthy();
  });

  it.each(["stacked", "shared row"] as const)("validates and updates %s fields independently", async (layout) => {
    const pages = layout === "shared row"
      ? [{ key: 0, rows: [fields.slice(0, 2), [fields[2]]] }]
      : singlePage;
    render(<Controlled pages={pages} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "A" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(name);
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    fireEvent.change(name, { target: { value: "Ada" } });
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Increase Count" }));
    expect(screen.getByDisplayValue("4")).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Accepted" }));
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe("Required");
  });

  it("revalidates edited fields after a parent value change", () => {
    const onChange = vi.fn();
    const initial: Values = { name: "Ada", count: 2, accepted: true };
    const { rerender } = render(<Form pages={singlePage} value={initial} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    rerender(<Form pages={singlePage} value={{ ...initial, name: "A" }} onChange={onChange} />);
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    rerender(<Form pages={singlePage} value={{ ...initial, name: "Valid" }} onChange={onChange} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("validates only the controlled value until the parent accepts an edit", () => {
    const validator = vi.fn((value: string) => value.length < 2 ? "Too short" : undefined);
    const pages = [{ key: 0, rows: [[{ key: "name" as const, input: { label: "Name", validator } }]] }];
    const { rerender } = render(<Form pages={pages} value={{ name: "" }} onChange={() => {}} />);
    expect(validator).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    expect(validator).not.toHaveBeenCalledWith("Ada");
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    rerender(<Form pages={pages} value={{ name: "Ada" }} onChange={() => {}} />);
    expect(validator).toHaveBeenLastCalledWith("Ada");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const steps: FormProps<Values>["pages"] = [
  { key: 0, rows: [[fields[0]]] },
  { key: 3, rows: [[fields[1]]] },
  { key: 8, rows: [[fields[2]]] },
];

function dot(step: number, errors = false) {
  return screen.getByLabelText(`Step ${step} of 3${errors ? ", has errors" : ""}`);
}

describe("Form steps", () => {
  it("keeps page warnings non-dismissible across validation and navigation", async () => {
    const warningPages = steps.map(page => page.key === 8 ? { ...page, warnings: ["This change has consequences"] } : page);
    render(<Controlled pages={warningPages} />);
    const warningDot = () => screen.getByLabelText("Step 3 of 3, has warnings");
    expect(warningDot().getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(warningDot().getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("This change has consequences");
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
    await userEvent.click(screen.getByRole("checkbox"));
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(dot(3, true).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("checkbox"));
    expect(warningDot().getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("This change has consequences");
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(warningDot().getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("owns warning dismissal by message for the lifetime of the form", async () => {
    const value: Values = { name: "Ada", count: 2, accepted: true };
    const example = (warnings: readonly string[]) => <Form pages={steps} value={value} onChange={() => {}}
      warnings={warnings} actions={<Button title="Submit" onPress={() => {}} />} />;
    const { rerender, unmount } = render(example(["First warning", "Second warning"]));
    await userEvent.click(within(screen.getByText("First warning").parentElement!).getByRole("button", { name: "Dismiss warning" }));
    expect(screen.queryByText("First warning")).toBeNull();
    expect(screen.getByText("Second warning")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    rerender(example(["Second warning"]));
    rerender(example([]));
    expect(screen.queryByRole("button", { name: "Dismiss warning" })).toBeNull();
    rerender(example(["First warning", "Second warning", "New warning"]));
    expect(screen.queryByText("First warning")).toBeNull();
    expect(screen.getByText("New warning")).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    unmount();
    render(example(["First warning"]));
    expect(screen.getByText("First warning")).toBeTruthy();
  });

  it("keeps caller warnings below actions while navigating", async () => {
    const value: Values = { name: "Ada", count: 2, accepted: true };
    render(<Form pages={steps} value={value} onChange={() => {}}
      warnings={["Check the effect on this pipe"]}
      actions={<Button title="Submit" onPress={() => {}} />} />);
    const warning = screen.getByRole("alert");
    const action = screen.getByRole("button", { name: "Submit" });
    expect(screen.getByRole("textbox", { name: "Name" }).compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(action.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("alert")).toBe(warning);
    expect(screen.getByRole("button", { name: "Submit" })).toBe(action);
  });

  it("starts at a page key, ignores later start changes, and owns buttons and swiping", async () => {
    const value: Values = { name: "Ada", count: 2, accepted: true };
    const { rerender } = render(<Form pages={steps} value={value} onChange={() => {}} navigationStart={3} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    rerender(<Form pages={steps} value={value} onChange={() => {}} navigationStart={8} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("checkbox")).toBeTruthy();
    const pager = screen.getByTestId("form-pager");
    Object.defineProperty(pager, "offsetWidth", { configurable: true, value: 320 });
    fireEvent.scroll(pager, { target: { scrollLeft: 0 } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy());
  });

  it("retains simultaneous field errors when inline validators change", async () => {
    function Example({ invalid }: { invalid: boolean }) {
      return <Form
        pages={[
          { key: 0, rows: [[{ key: "first", input: { label: "First", validator: () => invalid ? "First invalid" : undefined } }]] },
          { key: 1, rows: [[{ key: "second", input: { label: "Second", validator: () => invalid ? "Second invalid" : undefined } }]] },
        ]}
        value={{ first: "A", second: "B" }}
        onChange={() => {}}
      />;
    }
    const { rerender } = render(<Example invalid={false} />);
    fireEvent.blur(screen.getByRole("textbox", { name: "First" }));
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    fireEvent.blur(screen.getByRole("textbox", { name: "Second" }));
    rerender(<Example invalid />);
    expect(screen.getByLabelText("Step 1 of 2, has errors")).toBeTruthy();
    expect(screen.getByLabelText("Step 2 of 2, has errors")).toBeTruthy();
    rerender(<Example invalid={false} />);
    expect(screen.getByLabelText("Step 1 of 2")).toBeTruthy();
    expect(screen.getByLabelText("Step 2 of 2")).toBeTruthy();
  });

  it("shows caller-owned actions on every step beside edge-only chevrons", async () => {
    const submit = vi.fn();
    const value: Values = { name: "Ada", count: 2, accepted: true };
    render(<Form pages={steps} value={value} onChange={() => {}} actions={<Button title="Create" onPress={submit} />} />);
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(submit).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("button", { name: "Create" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next step" })).toBeTruthy();
  });

  it("renders warnings and actions on a single step without navigation or dots", async () => {
    const submit = vi.fn();
    const value: Values = { name: "Ada", count: 2, accepted: true };
    render(<Form pages={singlePage} value={value} onChange={() => {}}
      warnings={["Check your details"]}
      actions={<Button title="Create" onPress={submit} />} />);
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    expect(screen.queryByLabelText(/Step \d+ of/)).toBeNull();
    expect(screen.getByRole("button", { name: "Create" }).compareDocumentPosition(screen.getByRole("alert")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("hides offscreen fields and preserves edits through Next and Back", async () => {
    render(<Controlled pages={steps} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(dot(2).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("Ada");
  });

  it("marks invalid steps accessibly without blocking navigation", async () => {
    render(<Controlled pages={steps} />);
    expect(dot(1).getAttribute("aria-selected")).toBe("true");
    expect(dot(2).getAttribute("aria-selected")).toBe("false");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(dot(1, true).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(dot(1, true).getAttribute("aria-selected")).toBe("false");
    expect(dot(2).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    expect(dot(1).getAttribute("aria-selected")).toBe("true");
  });

  it("updates the current page from horizontal scrolling in both directions", async () => {
    render(<Controlled pages={steps} />);
    const pager = screen.getByTestId("form-pager");
    Object.defineProperty(pager, "offsetWidth", { configurable: true, value: 320 });
    fireEvent.scroll(pager, { target: { scrollLeft: 640 } });
    expect(dot(3).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("checkbox")).toBeTruthy();
    fireEvent.scroll(pager, { target: { scrollLeft: 0 } });
    await waitFor(() => expect(dot(1).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("renders a single nonzero page without navigation", () => {
    render(<Controlled pages={[{ key: 4, rows: fields.map(field => [field]) }]} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByTestId("form-pager")).toBeNull();
  });

  it("includes displayed Input validation errors in the step indicator", () => {
    render(<Controlled pages={steps.map(page => ({ ...page, rows: page.rows.map(row => row.map(field => field.key === "name" ? { ...field, input: { ...field.input, validator: () => "Already taken" } } : field)) }))} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(dot(1).getAttribute("aria-selected")).toBe("true");
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("alert").textContent).toBe("Already taken");
    expect(dot(1, true).getAttribute("aria-selected")).toBe("true");
  });

  it("makes offscreen pages inert on web without making the visible page inert", async () => {
    render(<Controlled pages={steps} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name.closest("[inert]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(name.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Count" }).closest("[inert]")).toBeNull();
  });

  it("keeps the selected step when another step is removed and falls back when it disappears", async () => {
    const { rerender } = render(<Controlled pages={steps} />);
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    rerender(<Controlled pages={steps.filter(page => page.key !== 0)} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    rerender(<Controlled pages={steps.filter(page => page.key !== 3)} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });
});
