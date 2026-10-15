// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Dimensions } from "react-native";
import { Popover } from "./Popover";

describe("Popover", () => {
  beforeEach(() => {
    vi.spyOn(Dimensions, "get").mockReturnValue({ width: 400, height: 800, scale: 1, fontScale: 1 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("keeps tall content within the viewport with a 16px top and bottom margin", () => {
    const anchorRef = {
      current: {
        measureInWindow: (callback: (x: number, y: number, width: number, height: number) => void) =>
          callback(0, 0, 40, 40),
      },
    } as any;

    render(
      <Popover visible onClose={() => {}} anchorRef={anchorRef} anchorPosition="left-start">
        <span>A tall popover</span>
      </Popover>,
    );

    const content = screen.getByTestId("popover-content");
    expect(content.style.left).toBe("16px");
    expect(content.style.top).toBe("16px");
    expect(content.style.maxHeight).toBe(`${Dimensions.get("window").height - 32}px`);
  });
});
