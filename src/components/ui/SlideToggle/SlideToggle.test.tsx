// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SlideToggle } from "./SlideToggle";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: { name: string }) => (
    <span data-testid={`icon-${name}`} />
  ),
}));

describe("SlideToggle", () => {
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
