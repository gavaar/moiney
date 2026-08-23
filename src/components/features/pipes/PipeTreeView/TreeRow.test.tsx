// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { TreeRow } from "./TreeRow";
import type { TreeRowData } from "./treeRows";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: { name: string }) => (
    <span data-testid="tree-row-icon" data-icon-name={name} />
  ),
}));

const pipeId = (value: string) => value as Id<"pipes">;

const pipe: PipeModel = {
  id: pipeId("rent"),
  name: "Rent",
  icon: "home-outline",
  priority: 0,
  capacity: 100,
  fed: 80,
  spent: 20,
};

const row: TreeRowData = {
  id: pipe.id,
  depth: 1,
  prefix: "branch",
  pipe,
  groupMax: 100,
  path: [pipeId("salary"), pipe.id],
  isLeaf: true,
};

describe("TreeRow", () => {
  it("renders a leaf bar and invokes its full-path callback", async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(<TreeRow row={row} onPress={onPress} />);

    expect(screen.getByText("Rent")).toBeDefined();
    expect(screen.getByTestId("mini-bar-capacity")).toBeDefined();

    await user.click(screen.getByText("Rent"));

    expect(onPress).toHaveBeenCalledOnce();
  });
});
