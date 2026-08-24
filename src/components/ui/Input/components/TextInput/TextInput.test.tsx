// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "./TextInput";

const getBorderStyle = vi.fn((..._args: unknown[]) => "");

vi.mock("../../input.config", () => ({
  getBorderStyle: (...args: unknown[]) => getBorderStyle(...args),
}));

describe("TextInput", () => {
  it("renders label and input", () => {
    render(<TextInput label="Name" placeholder="Enter name" />);
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByPlaceholderText("Enter name")).toBeTruthy();
  });

  it("shows error message", () => {
    render(<TextInput label="Name" error="Required" />);
    expect(screen.getByText("Required")).toBeTruthy();
  });

  it("does not show error when no error", () => {
    render(<TextInput label="Name" />);
    expect(screen.queryByText("Required")).toBeNull();
  });

  it("renders end icon button", () => {
    const onPress = vi.fn();
    render(<TextInput label="Password" endIcon="eye" onEndIconPress={onPress} />);
    expect(screen.getByTestId("end-icon-button")).toBeTruthy();
  });

  it("labels the input and password visibility control", () => {
    render(<TextInput label="Password" endIcon="eye" onEndIconPress={() => {}} />);

    expect(screen.getByRole("textbox", { name: "Password" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Show password" })).toBeTruthy();
  });

  it("handles end icon press", async () => {
    const onPress = vi.fn();
    render(<TextInput label="Password" endIcon="eye" onEndIconPress={onPress} />);
    await userEvent.click(screen.getByTestId("end-icon-button"));
    expect(onPress).toHaveBeenCalled();
  });

  it("shows checking status", () => {
    render(<TextInput label="Username" status="checking" />);
    expect(screen.getByTestId("status-checking")).toBeTruthy();
  });

  it("shows available status", () => {
    render(<TextInput label="Username" status="available" />);
    expect(screen.getByTestId("status-available")).toBeTruthy();
  });

  it("shows unavailable status", () => {
    render(<TextInput label="Username" status="unavailable" />);
    expect(screen.getByTestId("status-unavailable")).toBeTruthy();
  });

  it("composes consumer focus handlers with internal focus state", () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    render(
      <TextInput
        label="Name"
        placeholder="Enter name"
        onFocus={onFocus}
        onBlur={onBlur}
      />,
    );
    const input = screen.getByPlaceholderText("Enter name");

    fireEvent.focus(input);
    expect(onFocus).toHaveBeenCalledOnce();
    expect(getBorderStyle).toHaveBeenLastCalledWith(undefined, true, undefined);

    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledOnce();
    expect(getBorderStyle).toHaveBeenLastCalledWith(undefined, false, undefined);
  });

  it("keeps disabled authoritative over the editable prop", () => {
    render(
      <TextInput
        label="Name"
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
