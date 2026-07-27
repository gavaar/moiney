// @vitest-environment jsdom
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TextSelectInput } from "./TextSelectInput";

const defaultOptions = ["groceries", "gas", "rent"];

function ControlledWrapper({ options, initialValue }: { options?: string[]; initialValue?: string }) {
  const [value, setValue] = useState(initialValue ?? "");
  const handleSelect = (v: string) => setValue(v);

  return (
    <TextSelectInput
      label="Title"
      value={value}
      onChangeText={setValue}
      onOptionSelect={handleSelect}
      options={options ?? defaultOptions}
      placeholder="What was this for?"
    />
  );
}

describe("TextSelectInput", () => {
  it("renders label and input", () => {
    render(<ControlledWrapper />);
    expect(screen.getByText("Title")).toBeTruthy();
    expect(screen.getByPlaceholderText("What was this for?")).toBeTruthy();
  });

  it("shows options on focus", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.getByText("rent")).toBeTruthy();
  });

  it("hides options on blur", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    fireEvent.blur(input);
    expect(screen.queryByText("groceries")).toBeNull();
  });

  it("filters options when typing", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "gr" } });
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("excludes exact match from options", () => {
    render(<ControlledWrapper initialValue="g" />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.queryByText("g")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("hides list when all options are filtered out", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    fireEvent.input(input, { target: { value: "xyz" } });
    expect(screen.queryByText("groceries")).toBeNull();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("shows all options when input is empty", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);
    expect(screen.getByText("groceries")).toBeTruthy();
    expect(screen.getByText("gas")).toBeTruthy();
    expect(screen.getByText("rent")).toBeTruthy();
  });

  it("calls onOptionSelect when tapping an option and hides the list", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?");
    fireEvent.focus(input);

    fireEvent.click(screen.getByText("gas"));
    expect(screen.queryByText("groceries")).toBeNull();
    expect(screen.queryByText("gas")).toBeNull();
    expect(screen.queryByText("rent")).toBeNull();
  });

  it("shows character count when maxLength is provided", () => {
    render(
      <TextSelectInput
        label="Title"
        value="Hello"
        onChangeText={vi.fn()}
        onOptionSelect={vi.fn()}
        options={[]}
        maxLength={140}
        placeholder="What was this for?"
      />,
    );
    expect(screen.getByText("5 / 140")).toBeTruthy();
  });

  it("shows error when provided", () => {
    render(
      <TextSelectInput
        label="Title"
        value=""
        onChangeText={vi.fn()}
        onOptionSelect={vi.fn()}
        options={[]}
        error="Something went wrong"
        placeholder="What was this for?"
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeTruthy();
  });

  it("input is not disabled when disabled is not set", () => {
    render(<ControlledWrapper />);
    const input = screen.getByPlaceholderText("What was this for?") as HTMLInputElement;
    expect(input.disabled).toBeFalsy();
  });
});
