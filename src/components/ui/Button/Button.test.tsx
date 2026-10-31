// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Button } from "./Button";

describe("Button", () => {
  it("runs the action when enabled and blocks presses while disabled or loading", () => {
    const onPress = vi.fn();
    const { rerender } = render(<Button title="Run now" onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(onPress).toHaveBeenCalledOnce();

    rerender(<Button title="Run now" disabled onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(onPress).toHaveBeenCalledOnce();

    rerender(<Button title="Run now" loading onPress={onPress} />);
    fireEvent.click(screen.getByRole("button", { name: "Run now" }));
    expect(onPress).toHaveBeenCalledOnce();
  });

  it("keeps an accessible action name and busy state while loading", () => {
    render(<Button title="Run now" loading onPress={() => {}} />);

    const button = screen.getByRole("button", { name: "Run now" });
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
