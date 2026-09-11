// @vitest-environment jsdom
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IconName } from "@ui/Icon";
import { Input, type InputProps } from "./Input";

const options = [
  { label: "Bar view", icon: "align-horizontal-left" },
  { label: "Tree view", icon: "file-tree" },
] as const;

describe("Input toggle", () => {
  it("exposes a boolean value, optional callback, and exactly two labeled icons", () => {
    type Props = Extract<InputProps, { type: "toggle" }>;
    type Option = { label: string; icon: IconName };
    expectTypeOf<Props["value"]>().toEqualTypeOf<boolean>();
    expectTypeOf<Props["onChange"]>().toEqualTypeOf<((value: boolean) => void) | undefined>();
    expectTypeOf<Props["options"]>().toEqualTypeOf<readonly [Option, Option]>();
  });

  it("shows only the controlled selection's label and emits booleans in both directions", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Input type="toggle" options={options} value={false} onChange={onChange} />);
    expect(screen.getByText("Bar view")).toBeTruthy();
    expect(screen.queryByText("Tree view")).toBeNull();
    expect(screen.getByRole("radio", { name: "Bar view" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "Tree view" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
    expect(screen.getByText("Bar view")).toBeTruthy();

    rerender(<Input type="toggle" options={options} value={true} onChange={onChange} />);
    expect(screen.getByText("Tree view")).toBeTruthy();
    expect(screen.queryByText("Bar view")).toBeNull();
    expect(screen.getByRole("radio", { name: "Tree view" }).getAttribute("aria-selected")).toBe("true");
    await userEvent.click(screen.getByRole("radio", { name: "Bar view" }));
    expect(onChange).toHaveBeenNthCalledWith(2, false);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("exposes and clears validation errors without changing selection", () => {
    const { rerender } = render(<Input type="toggle" options={options} value={true} error="Choose a view" />);
    expect(screen.getByRole("alert").textContent).toBe("Choose a view");
    expect(screen.getByText("Tree view")).toBeTruthy();
    rerender(<Input type="toggle" options={options} value={true} />);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("allows pressing either option without a callback and stays controlled", async () => {
    render(<Input type="toggle" options={options} value={false} />);
    await userEvent.click(screen.getByRole("radio", { name: "Tree view" }));
    await userEvent.click(screen.getByRole("radio", { name: "Bar view" }));
    expect(screen.getByText("Bar view")).toBeTruthy();
    expect(screen.getByRole("radio", { name: "Bar view" }).getAttribute("aria-selected")).toBe("true");
  });

  it("disables both options without emitting and can be re-enabled", async () => {
    const onChange = vi.fn();
    const { rerender } = render(<Input type="toggle" options={options} value={false} onChange={onChange} disabled />);
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(radio);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByText("Bar view")).toBeTruthy();
    rerender(<Input type="toggle" options={options} value={false} onChange={onChange} disabled={false} />);
    await userEvent.click(screen.getByRole("radio", { name: "Tree view" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith(true);
  });
});
