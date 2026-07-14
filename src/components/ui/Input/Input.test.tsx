// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Input } from "./Input";

describe("Input", () => {
  it("renders TextInput for type='text' (default)", () => {
    render(<Input label="Name" placeholder="Enter name" />);
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
    render(<Input type="icon" label="Icon" value="" onSelect={() => {}} />);
    expect(screen.getByText("Icon")).toBeTruthy();
    expect(screen.getByText("---")).toBeTruthy();
  });
});
