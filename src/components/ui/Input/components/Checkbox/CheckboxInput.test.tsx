// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CheckboxInput } from "./CheckboxInput";

describe("CheckboxInput", () => {
  it("renders label and unchecked state", () => {
    render(<CheckboxInput label="Option" checked={false} onChange={() => {}} />);
    expect(screen.getByText("Option")).toBeTruthy();
    const checkbox = screen.getByTestId("checkbox-touchable");
    expect(checkbox).toBeTruthy();
  });

  it("shows checked indicator when checked", () => {
    render(<CheckboxInput label="Option" checked={true} onChange={() => {}} />);
    expect(screen.getByTestId("checkbox-checked-icon")).toBeTruthy();
  });

  it("toggles on press", async () => {
    const onChange = vi.fn();
    render(<CheckboxInput label="Option" checked={false} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("checkbox-touchable"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls onChange with false when checked and pressed", async () => {
    const onChange = vi.fn();
    render(<CheckboxInput label="Option" checked={true} onChange={onChange} />);
    await userEvent.click(screen.getByTestId("checkbox-touchable"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("does not toggle when disabled", () => {
    const onChange = vi.fn();
    render(<CheckboxInput label="Option" checked={false} onChange={onChange} disabled />);
    fireEvent.click(screen.getByTestId("checkbox-touchable"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
