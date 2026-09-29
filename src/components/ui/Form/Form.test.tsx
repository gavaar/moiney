// @vitest-environment jsdom
import { useState } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { Form, type FormProps } from ".";
import { colors } from "@/lib/styles";
import { Button } from "@ui/Button";

type Values = { name: string; count: number; accepted: boolean };
const fields: FormProps<Values>["form"] = [
  { key: "name", input: { label: "Name", validator: (value) => value.length < 2 ? "Too short" : undefined }, description: "Your display name" },
  { key: "count", input: { type: "number", label: "Count", step: 2 } },
  { key: "accepted", input: { type: "checkbox", label: "Accepted", validator: (value) => value ? undefined : "Required" } },
];

function Controlled({ form = fields }: { form?: FormProps<Values>["form"] }) {
  const [value, setValue] = useState<Values>({ name: "", count: 2, accepted: true });
  return <Form header={<Text>Custom header</Text>} form={form} value={value} onChange={setValue} />;
}

describe("Form controlled fields", () => {
  it("reveals optional fields without changing values and clears hidden error indicators on reset", async () => {
    const onChange = vi.fn();
    function Example({ disabled = false }: { disabled?: boolean }) {
      const [expanded, setExpanded] = useState(false);
      return <>
        <button onClick={() => setExpanded(false)}>Reset disclosure</button>
        <Form form={[
          { key: "name", input: { label: "Name" } },
          { key: "optional", input: { label: "Optional", disabled, validator: () => "Invalid optional" },
            reveal: { label: "Show optional", expanded, onReveal: () => setExpanded(true) } },
          { key: "last", step: 1, input: { label: "Last" } },
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

  it("renders a JSX header and description without single-step navigation", () => {
    render(<Controlled />);
    expect(screen.getByText("Custom header")).toBeTruthy();
    expect(screen.getByText("Your display name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("emits all and only declared keys and uses externally controlled values", () => {
    const onChange = vi.fn();
    const value = { name: "Old", count: 2, accepted: false, extra: "omit" };
    const { rerender } = render(<Form form={fields} value={value} onChange={(next) => {
      expectTypeOf(next).toEqualTypeOf<Values>();
      onChange(next);
    }} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "New" } });
    expect(onChange).toHaveBeenLastCalledWith({ name: "New", count: 2, accepted: false });
    rerender(<Form form={fields} value={{ ...value, name: "Parent update" }} onChange={onChange} />);
    expect(screen.getByDisplayValue("Parent update")).toBeTruthy();
  });

  it.each(["stacked", "shared row"] as const)("validates and updates %s fields independently", async (layout) => {
    const form = layout === "shared row"
      ? fields.map(field => field.key === "accepted" ? field : { ...field, row: "name-count" })
      : fields;
    render(<Controlled form={form} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "A" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(name);
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    fireEvent.change(name, { target: { value: "Ada" } });
    expect(screen.queryByRole("alert")).toBeNull();
    await userEvent.click(screen.getByTestId("increment-button"));
    expect(screen.getByDisplayValue("4")).toBeTruthy();
    await userEvent.click(screen.getByRole("checkbox", { name: "Accepted" }));
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("alert").textContent).toBe("Required");
  });

  it("revalidates edited fields after a parent value change", () => {
    const onChange = vi.fn();
    const initial: Values = { name: "Ada", count: 2, accepted: true };
    const { rerender } = render(<Form form={fields} value={initial} onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    rerender(<Form form={fields} value={{ ...initial, name: "A" }} onChange={onChange} />);
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    rerender(<Form form={fields} value={{ ...initial, name: "Valid" }} onChange={onChange} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("validates only the controlled value until the parent accepts an edit", () => {
    const validator = vi.fn((value: string) => value.length < 2 ? "Too short" : undefined);
    const form = [{ key: "name" as const, input: { label: "Name", validator } }];
    const { rerender } = render(<Form form={form} value={{ name: "" }} onChange={() => {}} />);
    expect(validator).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    expect(validator).not.toHaveBeenCalledWith("Ada");
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    rerender(<Form form={form} value={{ name: "Ada" }} onChange={() => {}} />);
    expect(validator).toHaveBeenLastCalledWith("Ada");
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const steps: FormProps<Values>["form"] = [
  { key: "accepted", input: { type: "checkbox", label: "Accepted", validator: (value) => value ? undefined : "Required" }, step: 8 },
  fields[0],
  { key: "count", input: { type: "number", label: "Count", step: 2 }, step: 3 },
];

function dot(step: number, errors = false) {
  return screen.getByLabelText(`Step ${step} of 3${errors ? ", has errors" : ""}`);
}

function background(element: HTMLElement) {
  return getComputedStyle(element).backgroundColor;
}

function rgb(color: string) {
  const element = document.createElement("div");
  element.style.backgroundColor = color;
  return element.style.backgroundColor;
}

describe("Form steps", () => {
  it("keeps caller warnings between the current page and actions while navigating", async () => {
    const value: Values = { name: "Ada", count: 2, accepted: true };
    render(<Form form={steps} value={value} onChange={() => {}}
      warnings={<Text accessibilityRole="alert">Check the effect on this pipe</Text>}
      actions={<Button title="Submit" onPress={() => {}} />} />);
    const warning = screen.getByRole("alert");
    const action = screen.getByRole("button", { name: "Submit" });
    expect(screen.getByRole("textbox", { name: "Name" }).compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(warning.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("alert")).toBe(warning);
    expect(screen.getByRole("button", { name: "Submit" })).toBe(action);
  });

  it("supports caller-controlled steps, navigation buttons, and swiping", async () => {
    function ControlledStep({ initialStep }: { initialStep: number }) {
      const [activeStep, setActiveStep] = useState(initialStep);
      const value: Values = { name: "Ada", count: 2, accepted: true };
      return <>
        <button onClick={() => setActiveStep(8)}>Jump to last</button>
        <Form form={steps} value={value} onChange={() => {}}
          activeStep={activeStep} onStepChange={setActiveStep} />
      </>;
    }
    render(<ControlledStep initialStep={3} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    await userEvent.click(screen.getByText("Jump to last"));
    expect(screen.getByRole("checkbox")).toBeTruthy();
    const pager = screen.getByTestId("form-pager");
    Object.defineProperty(pager, "offsetWidth", { configurable: true, value: 320 });
    fireEvent.scroll(pager, { target: { scrollLeft: 0 } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy());
  });

  it("retains simultaneous field errors when inline validators change", async () => {
    function Example({ invalid }: { invalid: boolean }) {
      return <Form
        form={[
          { key: "first", input: { label: "First", validator: () => invalid ? "First invalid" : undefined } },
          { key: "second", step: 1, input: { label: "Second", validator: () => invalid ? "Second invalid" : undefined } },
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
    render(<Form form={steps} value={value} onChange={() => {}} actions={<Button title="Create" onPress={submit} />} />);
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
    render(<Form form={fields} value={value} onChange={() => {}}
      warnings={<Text accessibilityRole="alert">Check your details</Text>}
      actions={<Button title="Create" onPress={submit} />} />);
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    expect(screen.queryByLabelText(/Step \d+ of/)).toBeNull();
    expect(screen.getByRole("alert").compareDocumentPosition(screen.getByRole("button", { name: "Create" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(submit).toHaveBeenCalledOnce();
  });

  it("sorts distinct steps, hides offscreen fields, and preserves edits through Next and Back", async () => {
    render(<Controlled form={steps} />);
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

  it("uses error/errorDark for invalid selected/unselected steps without blocking navigation", async () => {
    render(<Controlled form={steps} />);
    expect(background(dot(1))).toBe(rgb(colors.text));
    expect(background(dot(2))).toBe(rgb(colors.muted));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(background(dot(1, true))).toBe(rgb(colors.error));
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(background(dot(1, true))).toBe(rgb(colors.errorDark));
    expect(background(dot(2))).toBe(rgb(colors.text));
    await userEvent.click(screen.getByRole("button", { name: "Previous step" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    expect(background(dot(1))).toBe(rgb(colors.text));
  });

  it("updates the current page from horizontal scrolling in both directions", async () => {
    render(<Controlled form={steps} />);
    const pager = screen.getByTestId("form-pager");
    Object.defineProperty(pager, "offsetWidth", { configurable: true, value: 320 });
    fireEvent.scroll(pager, { target: { scrollLeft: 640 } });
    expect(dot(3).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("checkbox")).toBeTruthy();
    fireEvent.scroll(pager, { target: { scrollLeft: 0 } });
    await waitFor(() => expect(dot(1).getAttribute("aria-selected")).toBe("true"));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("groups equal nonzero steps into one view without navigation", () => {
    render(<Controlled form={fields.map((field) => ({ ...field, step: 4 }))} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next step" })).toBeNull();
    expect(screen.queryByTestId("form-pager")).toBeNull();
  });

  it("includes displayed Input validation errors in the step indicator", () => {
    render(<Controlled form={steps.map((field) => field.key === "name" ? { ...field, input: { ...field.input, validator: () => "Already taken" } } : field)} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(background(dot(1))).toBe(rgb(colors.text));
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    expect(screen.getByRole("alert").textContent).toBe("Already taken");
    expect(background(dot(1, true))).toBe(rgb(colors.error));
  });

  it("makes offscreen pages inert on web without making the visible page inert", async () => {
    render(<Controlled form={steps} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name.closest("[inert]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    expect(name.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Count" }).closest("[inert]")).toBeNull();
  });

  it("keeps the selected step when another step is removed and falls back when it disappears", async () => {
    const { rerender } = render(<Controlled form={steps} />);
    await userEvent.click(screen.getByRole("button", { name: "Next step" }));
    rerender(<Controlled form={steps.filter((field) => field.key !== "name")} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Previous step" })).toBeNull();
    rerender(<Controlled form={steps.filter((field) => field.key !== "count")} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });
});
