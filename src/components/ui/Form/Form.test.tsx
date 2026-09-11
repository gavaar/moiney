// @vitest-environment jsdom
import { useState } from "react";
import { Text } from "react-native";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { Form, type FormProps } from ".";
import { colors } from "@/lib/styles";

type Values = { name: string; count: number; accepted: boolean };
const fields: FormProps<Values>["form"] = [
  { key: "name", input: { label: "Name" }, validator: (value) => value.length < 2 ? "Too short" : null, description: "Your display name" },
  { key: "count", input: { type: "number", label: "Count", step: 2 }, validator: () => null },
  { key: "accepted", input: { type: "checkbox", label: "Accepted" }, validator: (value) => value ? null : "Required" },
];

function Controlled({ form = fields }: { form?: FormProps<Values>["form"] }) {
  const [value, setValue] = useState<Values>({ name: "", count: 2, accepted: true });
  return <Form header={<Text>Custom header</Text>} form={form} value={value} onChange={setValue} />;
}

describe("Form controlled fields", () => {
  it("renders a JSX header and description without single-step navigation", () => {
    render(<Controlled />);
    expect(screen.getByText("Custom header")).toBeTruthy();
    expect(screen.getByText("Your display name")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
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

  it("validates on edits, clears errors, and adapts number and checkbox changes", async () => {
    render(<Controlled />);
    const name = screen.getByRole("textbox", { name: "Name" });
    fireEvent.change(name, { target: { value: "A" } });
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
    expect(screen.getByRole("alert").textContent).toBe("Too short");
    rerender(<Form form={fields} value={{ ...initial, name: "Valid" }} onChange={onChange} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("validates the edited value even when the parent has not accepted it yet", () => {
    const validator = vi.fn((value: string) => value.length < 2 ? "Too short" : null);
    render(<Form form={[{ key: "name", input: { label: "Name" }, validator }]} value={{ name: "Ada" }} onChange={() => {}} />);
    expect(validator).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    expect(validator).toHaveBeenCalledWith("A");
    expect(screen.getByRole("alert").textContent).toBe("Too short");
  });
});

const steps: FormProps<Values>["form"] = [
  { ...fields[2], key: "accepted", input: { type: "checkbox", label: "Accepted" }, validator: (value) => value ? null : "Required", step: 8 },
  fields[0],
  { ...fields[1], key: "count", input: { type: "number", label: "Count", step: 2 }, validator: () => null, step: 3 },
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
  it("sorts distinct steps, hides offscreen fields, and preserves edits through Next and Back", async () => {
    render(<Controlled form={steps} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" }).getAttribute("aria-disabled")).toBe("true");
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    expect(screen.getByDisplayValue("2")).toBeTruthy();
    expect(dot(2).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("checkbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next" }).getAttribute("aria-disabled")).toBe("true");
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("Ada");
  });

  it("uses error/errorDark for invalid selected/unselected steps without blocking navigation", async () => {
    render(<Controlled form={steps} />);
    expect(background(dot(1))).toBe(rgb(colors.text));
    expect(background(dot(2))).toBe(rgb(colors.surface));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "A" } });
    expect(background(dot(1, true))).toBe(rgb(colors.error));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(background(dot(1, true))).toBe(rgb(colors.errorDark));
    expect(background(dot(2))).toBe(rgb(colors.text));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
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
    expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
    expect(screen.queryByTestId("form-pager")).toBeNull();
  });

  it("includes supplied Input errors in the step indicator", () => {
    render(<Controlled form={steps.map((field) => field.key === "name" ? { ...field, input: { ...field.input, error: "Already taken" } } : field)} />);
    expect(screen.getByRole("alert").textContent).toBe("Already taken");
    expect(background(dot(1, true))).toBe(rgb(colors.error));
  });

  it("makes offscreen pages inert on web without making the visible page inert", async () => {
    render(<Controlled form={steps} />);
    const name = screen.getByRole("textbox", { name: "Name" });
    expect(name.closest("[inert]")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(name.closest("[inert]")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Count" }).closest("[inert]")).toBeNull();
  });

  it("keeps the selected step when another step is removed and falls back when it disappears", async () => {
    const { rerender } = render(<Controlled form={steps} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    rerender(<Controlled form={steps.filter((field) => field.key !== "name")} />);
    expect(screen.getByRole("textbox", { name: "Count" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back" }).getAttribute("aria-disabled")).toBe("true");
    rerender(<Controlled form={steps.filter((field) => field.key !== "count")} />);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });
});
