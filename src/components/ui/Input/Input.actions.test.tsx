// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Text } from "react-native";
import { describe, expect, it, vi } from "vitest";
import { Input } from "./Input";

const variants = [
  { type: "text", value: "" },
  { type: "number", value: 5 },
  { type: "decimal", value: "5" },
  { type: "date", value: null },
  { type: "icon", value: "" },
  { type: "select", value: null, items: [], renderItem: () => null },
  { type: "text-select", value: "", options: [] },
] as const;

describe.each(variants)("$type accessories", props => {
  it("renders and runs both custom actions without changing the value or opening a picker", async () => {
    const onChange = vi.fn();
    const before = vi.fn();
    const after = vi.fn();
    render(<Input {...props} label="Field" onChange={onChange}
      prefix={{ content: <Text>Before</Text>, accessibilityLabel: "Before action", onPress: before }}
      suffix={{ content: <Text>After</Text>, accessibilityLabel: "After action", onPress: after }} />);

    await userEvent.click(screen.getByRole("button", { name: "Before action" }));
    await userEvent.click(screen.getByRole("button", { name: "After action" }));
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByTestId("modal-backdrop")).toBeNull();
    if (props.type === "text" || props.type === "number" || props.type === "decimal" || props.type === "text-select") {
      expect(document.activeElement).not.toBe(screen.getByRole("textbox", { name: "Field" }));
    }
  });

  it("disables both custom actions with the input", () => {
    const onPress = vi.fn();
    render(<Input {...props} label="Field" disabled
      prefix={{ content: <Text>Before</Text>, accessibilityLabel: "Before action", onPress }}
      suffix={{ content: <Text>After</Text>, accessibilityLabel: "After action", onPress }} />);
    for (const name of ["Before action", "After action"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe("numeric accessory defaults", () => {
  it("replaces only Number's prefix and retains the default increment action", () => {
    const before = vi.fn();
    const onChange = vi.fn();
    render(<Input type="number" label="Count" value={5} onChange={onChange}
      prefix={{ content: <Text>Reset</Text>, accessibilityLabel: "Reset count", onPress: before }} />);
    expect(screen.queryByRole("button", { name: "Decrease Count" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset count" }));
    expect(before).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Increase Count" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(6);
  });

  it("replaces only Number's suffix and retains the default decrement action", () => {
    const after = vi.fn();
    const onChange = vi.fn();
    render(<Input type="number" label="Count" value={5} onChange={onChange}
      suffix={{ content: <Text>Reset</Text>, accessibilityLabel: "Reset count", onPress: after }} />);
    expect(screen.queryByRole("button", { name: "Increase Count" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Reset count" }));
    expect(after).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Decrease Count" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(4);
  });

  it.each(["prefix", "suffix"] as const)("hides only Number's %s default when explicitly null", side => {
    render(<Input type="number" label="Count" value={5} {...{ [side]: null }} />);
    const hidden = side === "prefix" ? "Decrease Count" : "Increase Count";
    const visible = side === "prefix" ? "Increase Count" : "Decrease Count";
    expect(screen.queryByRole("button", { name: hidden })).toBeNull();
    expect(screen.getByRole("button", { name: visible })).toBeTruthy();
  });

  it("preserves Number's boundary disabling for the default actions", () => {
    const onChange = vi.fn();
    render(<Input type="number" label="Count" value={5} min={5} max={5} onChange={onChange} />);
    for (const name of ["Decrease Count", "Increase Count"]) {
      const button = screen.getByRole("button", { name });
      expect(button.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(button);
    }
    expect(onChange).not.toHaveBeenCalled();
  });

  it("keeps Decimal's sign prefix when only a suffix is supplied", () => {
    const onChange = vi.fn();
    render(<Input type="decimal" label="Amount" value="5" onChange={onChange}
      suffix={{ content: <Text>Reset</Text>, accessibilityLabel: "Reset amount", onPress: () => {} }} />);
    fireEvent.click(screen.getByRole("button", { name: "Change Amount sign, currently positive" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("-5");
  });

  it("hides Decimal's default prefix when explicitly null", () => {
    render(<Input type="decimal" label="Amount" value="5" prefix={null} />);
    expect(screen.queryByRole("button", { name: /Change Amount sign/ })).toBeNull();
    expect(screen.getByDisplayValue("5")).toBeTruthy();
  });
});
