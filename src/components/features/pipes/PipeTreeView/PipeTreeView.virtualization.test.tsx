// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { PipeTreeView } from "./PipeTreeView";

vi.mock("react-native", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-native")>();
  return {
    ...actual,
    FlatList: ({ data, renderItem, keyExtractor }: any) => (
      <div data-testid="pipe-tree-flat-list" data-count={data.length}>
        {data.map((item: any, index: number) => (
          <div key={keyExtractor(item, index)}>{renderItem({ item, index })}</div>
        ))}
      </div>
    ),
  };
});

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: { name: string }) => (
    <span data-testid="tree-icon" data-icon-name={name} />
  ),
}));

const root: PipeModel = {
  id: "root" as Id<"pipes">,
  name: "Root",
  icon: "pipe",
  priority: 0,
  capacity: 100,
  fed: 50,
  spent: 10,
};

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    feeds: [root],
    childrenByParent: new Map(),
  }),
}));

describe("PipeTreeView virtualization", () => {
  it("passes tree rows to a virtualized list without changing selection", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipeTreeView onSelectPipe={onSelectPipe} />);

    expect(
      screen.getByTestId("pipe-tree-flat-list").getAttribute("data-count"),
    ).toBe("1");

    await user.click(screen.getByText("Root"));
    expect(onSelectPipe).toHaveBeenCalledWith([root.id]);
  });
});
