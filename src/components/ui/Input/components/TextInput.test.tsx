// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TextInput } from "./TextInput";

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
});
