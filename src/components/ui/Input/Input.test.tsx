// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Input, type InputProps } from "./Input";

describe("Input", () => {
  it("requires controlled values and preserves variant-specific emissions", () => {
    type TextProps = Extract<InputProps, { type?: "text" }>;
    type DateProps = Extract<InputProps, { type: "date" }>;
    type SingleSelectProps = Extract<InputProps, { type: "select"; multiple?: false }>;
    type MultipleSelectProps = Extract<InputProps, { type: "select"; multiple: true }>;

    expectTypeOf<TextProps["value"]>().toEqualTypeOf<string>();
    expectTypeOf<TextProps["onChange"]>().toEqualTypeOf<(value: string) => void>();
    expectTypeOf<Extract<keyof TextProps, "defaultValue" | "onChangeText">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof Extract<InputProps, { type: "checkbox" }>, "checked">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof Extract<InputProps, { type: "icon" }>, "onSelect">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof SingleSelectProps, "onSelect">>().toEqualTypeOf<never>();
    expectTypeOf<Extract<keyof Extract<InputProps, { type: "text-select" }>, "onChangeText" | "onOptionSelect">>().toEqualTypeOf<never>();
    expectTypeOf<DateProps["value"]>().toEqualTypeOf<Date | null>();
    expectTypeOf<Parameters<DateProps["onChange"]>>().toEqualTypeOf<[Date]>();
    expectTypeOf<SingleSelectProps["value"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Parameters<SingleSelectProps["onChange"]>>().toEqualTypeOf<[string]>();
    expectTypeOf<MultipleSelectProps["value"]>().toEqualTypeOf<readonly string[]>();
    expectTypeOf<Parameters<MultipleSelectProps["onChange"]>>().toEqualTypeOf<[string[]]>();
  });

  it("renders checkbox validation errors without changing its checked value", async () => {
    const onChange = vi.fn();
    render(<Input type="checkbox" label="Accepted" value={true} onChange={onChange} error="Required" />);
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.getByRole("checkbox").getAttribute("aria-checked")).toBe("true");
    await userEvent.click(screen.getByRole("checkbox", { name: "Accepted" }));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("renders TextInput for type='text' (default)", () => {
    render(<Input label="Name" value="" onChange={() => {}} placeholder="Enter name" />);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter name")).toBeTruthy();
  });

  it("renders NumberInput for type='number'", () => {
    render(<Input type="number" label="Priority" value={5} onChange={() => {}} />);
    expect(screen.getByText("Priority")).toBeTruthy();
    expect(screen.getByTestId("decrement-button")).toBeTruthy();
    expect(screen.getByTestId("increment-button")).toBeTruthy();
    expect(screen.getByDisplayValue("5")).toBeTruthy();
  });

  it("renders IconInput for type='icon'", () => {
    render(<Input type="icon" label="Icon" value="" onChange={() => {}} />);
    expect(screen.getByText("Icon")).toBeTruthy();
    expect(screen.getByText("---")).toBeTruthy();
  });

  it("renders SelectInput for type='select'", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const items = [{ id: "1", name: "Groceries" }];
    render(
      <Input
        type="select"
        label="From"
        items={items}
        renderItem={(item) => <>{item.name}</>}
        value={null}
        onChange={onChange}
      />,
    );
    expect(screen.getByText("From")).toBeTruthy();
    await user.click(screen.getByTestId("select-trigger"));
    await user.click(screen.getByText("Groceries"));
    expect(onChange).toHaveBeenCalledWith("1");
  });

  it.each([undefined, "text"] as const)("emits strings for text type %s", (type) => {
    const onChange = vi.fn();
    render(<Input type={type} label="Name" value="" onChange={onChange} />);
    fireEvent.input(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Ada" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("Ada");
  });

  it("emits the selected icon through onChange", async () => {
    const onChange = vi.fn();
    render(<Input type="icon" label="Icon" value="" onChange={onChange} />);
    await userEvent.click(screen.getByTestId("icon-picker-trigger"));
    await userEvent.click(screen.getByText("wallet-outline"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("wallet-outline");
  });

  it("emits typed text through text-select onChange", () => {
    const onChange = vi.fn();
    render(<Input type="text-select" label="Title" value="" onChange={onChange} options={["gas"]} />);
    fireEvent.input(screen.getByRole("textbox", { name: "Title" }), { target: { value: "groceries" } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith("groceries");
  });

  it("emits suggestions through text-select onChange", () => {
    const onChange = vi.fn();
    render(<Input type="text-select" label="Title" value="" onChange={onChange} options={["gas"]} />);
    fireEvent.focus(screen.getByRole("textbox", { name: "Title" }));
    fireEvent.click(screen.getByText("gas"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("gas");
  });
});
