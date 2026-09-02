// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DecimalInput } from "./DecimalInput";
import { useState } from "react";

function renderControlledDecimalInput() {
  const onChange = vi.fn();

  function ControlledDecimalInput() {
    const [value, setValue] = useState("-");

    return (
      <DecimalInput
        label="Amount"
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          setValue(nextValue);
        }}
      />
    );
  }

  render(<ControlledDecimalInput />);
  return onChange;
}

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

  it("labels the decimal field", () => {
    render(<DecimalInput label="Amount" value="" onChange={() => {}} />);
    expect(screen.getByRole("textbox", { name: "Amount" })).toBeTruthy();
  });

  it("accepts digit input", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "42" } });
    expect(onChange).toHaveBeenCalledWith("42");
  });

  it("accepts decimal input", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "100.53" } });
    expect(onChange).toHaveBeenCalledWith("100.53");
  });

  it("allows trailing decimal point", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "100." } });
    expect(onChange).toHaveBeenCalledWith("100.");
  });

  it("strips non-numeric characters except decimal point", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
    const input = screen.getByDisplayValue("");
    fireEvent.change(input, { target: { value: "abc12.34xyz" } });
    expect(onChange).toHaveBeenCalledWith("12.34");
  });

  it("prevents multiple decimal points", () => {
    const onChange = vi.fn();
    render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
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
    it("treats an empty parent value as positive without changing it", () => {
      const onChange = vi.fn();

      render(<DecimalInput label="Amount" value="" onChange={onChange} />);

      expect(screen.getByRole("button", {
        name: "Change Amount sign, currently positive",
      })).toBeTruthy();
      expect(onChange).not.toHaveBeenCalled();
    });

    it("applies a negative empty value when digits are entered", () => {
      const onChange = renderControlledDecimalInput();

      expect(screen.getByRole("button", { name: "Change Amount sign, currently negative" })).toBeTruthy();

      fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), {
        target: { value: "42" },
      });

      expect(onChange).toHaveBeenLastCalledWith("-42");
    });

    it("displays the sign separately and toggles it when pressed", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="-42" onChange={onChange} />);

      fireEvent.click(screen.getByRole("button", {
        name: "Change Amount sign, currently negative",
      }));

      expect(screen.getByDisplayValue("42")).toBeTruthy();
      expect(onChange).toHaveBeenCalledWith("42");
    });

    it("toggles the sign badge before a number is entered", () => {
      const onChange = renderControlledDecimalInput();

      fireEvent.click(screen.getByRole("button", {
        name: "Change Amount sign, currently negative",
      }));

      expect(screen.getByRole("button", {
        name: "Change Amount sign, currently positive",
      })).toBeTruthy();

      fireEvent.change(screen.getByRole("textbox", { name: "Amount" }), {
        target: { value: "42" },
      });
      expect(onChange).toHaveBeenCalledWith("42");
    });

    it("toggles the default negative sign when minus is typed", () => {
      const onChange = renderControlledDecimalInput();
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "-42" } });
      expect(onChange).toHaveBeenLastCalledWith("42");
    });

    it("toggles the default sign while preserving a decimal", () => {
      const onChange = renderControlledDecimalInput();
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "-10.50" } });
      expect(onChange).toHaveBeenLastCalledWith("10.50");
    });

    it("strips minus sign when allowNegative is false", () => {
      const onChange = vi.fn();
      render(<DecimalInput label="Amount" value="" onChange={onChange} allowNegative={false} />);
      const input = screen.getByDisplayValue("");
      expect(screen.queryByRole("button", { name: /Change Amount sign/ })).toBeNull();
      fireEvent.change(input, { target: { value: "-42" } });
      expect(onChange).toHaveBeenCalledWith("42");
    });

    it("strips non-numeric characters while using minus to toggle", () => {
      const onChange = renderControlledDecimalInput();
      const input = screen.getByDisplayValue("");
      fireEvent.change(input, { target: { value: "abc-12.34xyz" } });
      expect(onChange).toHaveBeenLastCalledWith("12.34");
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
      const input = screen.getByRole("textbox", { name: "Amount" });
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
      const input = screen.getByRole("textbox", { name: "Amount" });
      fireEvent.change(input, { target: { value: "-12-34" } });
      expect(onChange).toHaveBeenCalledWith("1234");
    });
  });
});
