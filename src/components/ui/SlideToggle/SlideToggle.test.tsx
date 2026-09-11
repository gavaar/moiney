// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlideToggle } from "./SlideToggle";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

describe("SlideToggle", () => {
  it("exposes disabled state on both options and prevents selection", () => {
    const onChange = vi.fn();
    render(
      <SlideToggle
        options={[
          { value: "bar", label: "Bar view", icon: "align-horizontal-left" },
          { value: "tree", label: "Tree view", icon: "file-tree" },
        ]}
        value="bar"
        onChange={onChange}
        disabled
      />,
    );
    for (const radio of screen.getAllByRole("radio")) {
      expect(radio.getAttribute("aria-disabled")).toBe("true");
      fireEvent.click(radio);
    }
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: "Bar view" }).getAttribute("aria-selected")).toBe("true");
  });

  it("exposes labeled radio options with selected state and direct selection", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <SlideToggle
        options={[
          { value: "bar", label: "Bar view", icon: "align-horizontal-left" },
          { value: "tree", label: "Tree view", icon: "file-tree" },
        ]}
        value="bar"
        onChange={onChange}
      />,
    );

    const bar = screen.getByRole("radio", { name: "Bar view" });
    const tree = screen.getByRole("radio", { name: "Tree view" });
    expect(bar.getAttribute("aria-selected")).toBe("true");
    expect(tree.getAttribute("aria-selected")).toBe("false");

    await user.click(tree);
    expect(onChange).toHaveBeenCalledWith("tree");
  });
});
