// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Text } from "react-native";
import { Input as TextInput } from "../../Input";

describe("TextInput", () => {
  it("renders label and input", () => {
    render(<TextInput label="Name" value="" onChange={() => {}} placeholder="Enter name" />);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter name")).toBeTruthy();
  });

  it("validates on blur and stays live after correcting an error", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return <TextInput label="Name" value={value} onChange={setValue} validator={value => value.length < 3 ? "Required" : undefined} />;
    }
    render(<Controlled />);
    const input = screen.getByRole("textbox", { name: "Name" });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.blur(input);
    expect(screen.getByText("Required")).toBeTruthy();
    fireEvent.change(input, { target: { value: "ab" } });
    expect(screen.getByText("Required")).toBeTruthy();
    fireEvent.change(input, { target: { value: "abc" } });
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(input, { target: { value: "a" } });
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("rechecks dirty inputs on external value and validator changes", () => {
    const validator = (value: string) => value ? undefined : "Required";
    const { rerender } = render(<TextInput label="Name" value="" validator={validator} />);
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByRole("alert").textContent).toBe("Required");
    rerender(<TextInput label="Name" value="" validator={() => "Unavailable"} />);
    expect(screen.getByRole("alert").textContent).toBe("Unavailable");
    rerender(<TextInput label="Name" value="Valid" validator={validator} />);
    expect(screen.queryByRole("alert")).toBeNull();
    rerender(<TextInput label="Name" value="" validator={validator} />);
    expect(screen.getByRole("alert").textContent).toBe("Required");
  });

  it("displays controlled initial values and external resets", () => {
    const { rerender } = render(<TextInput label="Name" value="Initial" />);
    expect(screen.getByDisplayValue("Initial")).toBeTruthy();
    rerender(<TextInput label="Name" value="Reset" />);
    expect(screen.getByDisplayValue("Reset")).toBeTruthy();
  });

  it("keeps validating the controlled value when the parent rejects an edit", () => {
    render(<TextInput label="Name" value="" validator={value => value ? undefined : "Required"} onChange={() => {}} />);
    const input = screen.getByRole("textbox");
    fireEvent.blur(input);
    expect(screen.getByRole("alert")).toBeTruthy();
    fireEvent.change(input, { target: { value: "Valid" } });
    expect(screen.getByRole("alert").textContent).toBe("Required");
    expect(screen.getByDisplayValue("")).toBeTruthy();
  });

  it("treats an empty error string as an error and restores the counter on correction", () => {
    function Controlled() {
      const [value, setValue] = useState("");
      return <TextInput label="Name" value={value} onChange={setValue} maxLength={10} validator={value => value ? undefined : ""} />;
    }
    render(<Controlled />);
    expect(screen.getByText("0 / 10")).toBeTruthy();
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(screen.queryByText("0 / 10")).toBeNull();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A" } });
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("1 / 10")).toBeTruthy();
  });

  it("does not validate disabled interactions and resets validation on remount", () => {
    const validator = vi.fn(() => "Required");
    const { rerender } = render(<TextInput label="Name" value="" disabled validator={validator} />);
    fireEvent.blur(screen.getByRole("textbox"));
    expect(validator).not.toHaveBeenCalled();
    rerender(<TextInput label="Name" value="" validator={validator} />);
    fireEvent.blur(screen.getByRole("textbox"));
    expect(screen.getByRole("alert")).toBeTruthy();
    rerender(<TextInput key="reset" label="Name" value="" validator={validator} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("does not show error when no error", () => {
    render(<TextInput label="Name" value="" onChange={() => {}} />);
    expect(screen.queryByText("Required")).toBeNull();
  });

  it("renders a suffix button", () => {
    const onPress = vi.fn();
    render(<TextInput label="Password" value="" onChange={() => {}}
      suffix={{ content: <Text>Eye</Text>, accessibilityLabel: "Show password", onPress }} />);
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("labels the input and password visibility control", () => {
    render(<TextInput label="Password" value="" onChange={() => {}}
      suffix={{ content: <Text>Eye</Text>, accessibilityLabel: "Show password", onPress: () => {} }} />);

    expect(screen.getByRole("textbox", { name: "Password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("handles suffix presses alongside an informational status", async () => {
    const onPress = vi.fn();
    render(<TextInput label="Password" value="" onChange={() => {}} status="available"
      suffix={{ content: <Text>Eye</Text>, accessibilityLabel: "Show password", onPress }} />);
    expect(screen.getByRole("img", { name: "Password available" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows checking status", () => {
    render(<TextInput label="Username" value="" onChange={() => {}} status="checking" />);
    expect(screen.getByTestId("status-checking")).toBeTruthy();
  });

  it("shows available status", () => {
    render(<TextInput label="Username" value="" onChange={() => {}} status="available" />);
    expect(screen.getByTestId("status-available")).toBeTruthy();
  });

  it("shows unavailable status", () => {
    render(<TextInput label="Username" value="" onChange={() => {}} status="unavailable" />);
    expect(screen.getByTestId("status-unavailable")).toBeTruthy();
  });

  it("preserves input focus and consumer handlers while validating on blur", async () => {
    const user = userEvent.setup();
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextInput
        label="Name"
        value=""
        onChange={() => {}}
        placeholder="Enter name"
        onFocus={onFocus}
        onBlur={onBlur}
        validator={() => "Required"}
      />,
    );
    const input = screen.getByPlaceholderText("Enter name");

    await user.click(input);
    expect(onFocus).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(input);
    expect(screen.queryByRole("alert")).toBeNull();

    await user.tab();
    expect(onBlur).toHaveBeenCalledOnce();
    expect(document.activeElement).not.toBe(input);
    expect(screen.getByRole("alert").textContent).toBe("Required");
  });

  it("keeps disabled authoritative over the editable prop", () => {
    render(
      <TextInput
        label="Name"
        value=""
        onChange={() => {}}
        placeholder="Enter name"
        disabled
        editable
      />,
    );

    expect(
      (screen.getByPlaceholderText("Enter name") as HTMLInputElement).readOnly,
    ).toBe(true);
  });
});
