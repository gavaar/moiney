// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dimensions } from "react-native";
import { Popover } from "./Popover";

describe("Popover", () => {
  it("dismisses when its backdrop is pressed", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const anchorRef = {
      current: {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callback(10, 10, 40, 40),
      },
    } as any;

    render(
      <Popover visible onClose={onClose} anchorRef={anchorRef}>
        <span>Menu</span>
      </Popover>,
    );

    expect(screen.getByText("Menu")).toBeDefined();
    await user.click(screen.getByTestId("popover-backdrop"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("limits content to 85 percent of the viewport width", () => {
    const anchorRef = {
      current: {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callback(10, 10, 40, 40),
      },
    } as any;

    render(
      <Popover visible onClose={() => {}} anchorRef={anchorRef}>
        <span>A long popover label</span>
      </Popover>,
    );

    expect(screen.getByTestId("popover-content").style.maxWidth).toBe(
      `${Dimensions.get("window").width * 0.85}px`,
    );
  });
});
