// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ScreenHeader } from "./ScreenHeader";

describe("ScreenHeader", () => {
  it("activates only the title action with Enter and Space while keeping sibling actions independent", async () => {
    const user = userEvent.setup();
    const onTitlePress = vi.fn();
    const onLeftPress = vi.fn();
    const onRightPress = vi.fn();
    render(<ScreenHeader title="History"
      titleAction={{ onPress: onTitlePress, label: "History, Pipes shortcut" }}
      left={<button onClick={onLeftPress}>Version</button>}
      right={<button onClick={onRightPress}>View mode</button>} />);

    await user.tab();
    await user.keyboard("{Enter}");
    expect(onLeftPress).toHaveBeenCalledOnce();
    expect(onTitlePress).not.toHaveBeenCalled();
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "History, Pipes shortcut" }));
    await user.keyboard("{Enter}");
    await user.keyboard(" ");
    expect(onTitlePress).toHaveBeenCalledTimes(2);
    await user.tab();
    await user.keyboard("{Enter}");
    expect(onRightPress).toHaveBeenCalledOnce();
    expect(onTitlePress).toHaveBeenCalledTimes(2);
  });

  it("renders injected left and right content without owning feature behavior", () => {
    render(
      <ScreenHeader
        title="History"
        left={<span data-testid="left-content">left</span>}
        right={<span data-testid="right-content">right</span>}
      />,
    );

    expect(screen.getByText("History")).toBeDefined();
    expect(screen.getByTestId("left-content")).toBeDefined();
    expect(screen.getByTestId("right-content")).toBeDefined();
  });
});
