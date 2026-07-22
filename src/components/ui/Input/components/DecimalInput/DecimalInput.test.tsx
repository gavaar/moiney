// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecimalInput } from "./DecimalInput";

describe("DecimalInput", () => {
  it("renders label", () => {
    render(<DecimalInput label="Amount" value="" onChange={() => {}} />);
    expect(screen.getByText("Amount")).toBeTruthy();
  });

  it("shows placeholder", () => {
    render(
      <DecimalInput label="Amount" value="" onChange={() => {}} placeholder="100.53" />,
    );
    expect(screen.getByPlaceholderText("100.53")).toBeTruthy();
  });

  it("accepts digit input", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith("42");
  });

  it("accepts decimal input", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "100.53" } });
    expect(onChange).toHaveBeenCalledWith("100.53");
  });

  it("allows trailing decimal point", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "100." } });
    expect(onChange).toHaveBeenCalledWith("100.");
  });

  it("strips non-numeric characters except decimal point", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "abc12.34xyz" } });
    expect(onChange).toHaveBeenCalledWith("12.34");
  });

  it("prevents multiple decimal points", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "1.2.3" } });
    expect(onChange).toHaveBeenCalledWith("1.23");
  });

  it("shows error message", () => {
    render(
      <DecimalInput label="Amount" value="" onChange={() => {}} error="Invalid amount" />,
    );
    expect(screen.getByText("Invalid amount")).toBeTruthy();
  });

  describe("allowNegative", () => {
    it("defaults to true and preserves minus sign", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="" onChange={onChange} />);
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "-42" } });
      expect(onChange).toHaveBeenCalledWith("-42");
    });

    it("preserves negative decimal", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="" onChange={onChange} />);
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "-10.50" } });
      expect(onChange).toHaveBeenCalledWith("-10.50");
    });

    it("strips minus sign when allowNegative is false", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "-42" } });
      expect(onChange).toHaveBeenCalledWith("42");
    });

    it("strips non-numeric characters while keeping minus", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="" onChange={onChange} />);
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "abc-12.34xyz" } });
      expect(onChange).toHaveBeenCalledWith("-12.34");
    });

    it("toggles from positive to negative when '-' is typed", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="1234" onChange={onChange} />);
      const input = screen.getByDisplayValue("1234");
      fireEvent.change(input, { target: { value: "-1234" } });
      expect(onChange).toHaveBeenCalledWith("-1234");
    });

    it("toggles from negative to positive when '-' is typed on negative value", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="-1234" onChange={onChange} />);
      const input = screen.getByDisplayValue("-1234");
      fireEvent.change(input, { target: { value: "--1234" } });
      expect(onChange).toHaveBeenCalledWith("1234");
    });

    it("toggles sign when '-' appears in the middle of the string", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="1234" onChange={onChange} />);
      const input = screen.getByDisplayValue("1234");
      fireEvent.change(input, { target: { value: "12-34" } });
      expect(onChange).toHaveBeenCalledWith("-1234");
    });

    it("toggles sign when '-' appears in the middle of a negative string", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="-1234" onChange={onChange} />);
      const input = screen.getByDisplayValue("-1234");
      fireEvent.change(input, { target: { value: "-12-34" } });
      expect(onChange).toHaveBeenCalledWith("1234");
    });
  });
});
