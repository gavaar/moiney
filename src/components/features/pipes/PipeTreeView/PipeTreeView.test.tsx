// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";
import { PipeTreeView } from "./PipeTreeView";

vi.mock("@ui/Icon", () => ({
  Icon: ({ name }: any) => <span data-testid="icon" data-icon-name={name} />,
}));

vi.mock("@/lib/styles", () => ({
  colors: { error: "#C05959", success: "#46AE82" },
}));

vi.mock("@features/pipes/context/PipeSelectionContext", () => {
  const feeds = [
    { _id: "feed-1" as Id<"pipes">, name: "Salary", icon: "cash-outline", priority: 0, capacity: 1000, fed: 800, spent: 300 },
    { _id: "feed-2" as Id<"pipes">, name: "Gifts", icon: "gift-outline", priority: 0, capacity: 500, fed: 200, spent: 50 },
  ];

  const child1 = { _id: "child-1-1" as Id<"pipes">, name: "Rent", icon: "home-outline", priority: 0, capacity: 600, fed: 500, spent: 500 };
  const child2 = { _id: "child-1-2" as Id<"pipes">, name: "Food", icon: "cart-outline", priority: 1, capacity: 400, fed: 300, spent: 150 };

  const grandchild1 = { _id: "gc-1-1-1" as Id<"pipes">, name: "Electricity", icon: "flash-outline", priority: 0, capacity: 200, fed: 150, spent: 100 };
  const grandchild2 = { _id: "gc-1-1-2" as Id<"pipes">, name: "Water", icon: "water-outline", priority: 1, capacity: 100, fed: 80, spent: 40 };

  const childrenByParent = new Map<Id<"pipes">, any[]>();
  childrenByParent.set("feed-1" as Id<"pipes">, [child1, child2]);
  childrenByParent.set("feed-2" as Id<"pipes">, []);
  childrenByParent.set("child-1-1" as Id<"pipes">, [grandchild1, grandchild2]);

  return {
    usePipeSelection: () => ({
      feeds,
      childrenByParent,
      selectedPipePath: [],
      isLoading: false,
    }),
    toPipe: (doc: any) => ({
      _id: doc._id,
      name: doc.name,
      icon: doc.icon,
      priority: doc.priority,
      capacity: doc.capacity ?? 0,
      fed: doc.fed ?? 0,
      spent: doc.spent ?? 0,
    }),
  };
});

describe("PipeTreeView", () => {
  it("renders all pipes by name", () => {
    render(<PipeTreeView onSelectPipe={vi.fn()} />);
    expect(screen.getByText("Salary")).toBeDefined();
    expect(screen.getByText("Gifts")).toBeDefined();
    expect(screen.getByText("Rent")).toBeDefined();
    expect(screen.getByText("Food")).toBeDefined();
    expect(screen.getByText("Electricity")).toBeDefined();
    expect(screen.getByText("Water")).toBeDefined();
  });

  it("renders an icon for each pipe", () => {
    render(<PipeTreeView onSelectPipe={vi.fn()} />);
    expect(screen.getAllByTestId("icon")).toHaveLength(6);
  });

  it("passes the correct icon name to each pipe", () => {
    render(<PipeTreeView onSelectPipe={vi.fn()} />);
    const icons = screen.getAllByTestId("icon");
    const names = icons.map((el) => el.getAttribute("data-icon-name"));
    expect(names).toContain("cash-outline");
    expect(names).toContain("gift-outline");
    expect(names).toContain("home-outline");
    expect(names).toContain("cart-outline");
    expect(names).toContain("flash-outline");
    expect(names).toContain("water-outline");
  });

  it("calls onSelectPipe with [feedId] when tapping a feed", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipeTreeView onSelectPipe={onSelectPipe} />);

    await user.click(screen.getByText("Gifts"));
    expect(onSelectPipe).toHaveBeenCalledWith(["feed-2"]);
  });

  it("calls onSelectPipe with [feedId, childId] when tapping a child", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipeTreeView onSelectPipe={onSelectPipe} />);

    await user.click(screen.getByText("Rent"));
    expect(onSelectPipe).toHaveBeenCalledWith(["feed-1", "child-1-1"]);
  });

  it("calls onSelectPipe with [feedId, childId, grandchildId] when tapping a grandchild", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipeTreeView onSelectPipe={onSelectPipe} />);

    await user.click(screen.getByText("Electricity"));
    expect(onSelectPipe).toHaveBeenCalledWith(["feed-1", "child-1-1", "gc-1-1-1"]);
  });

  it("renders both children under a parent", () => {
    render(<PipeTreeView onSelectPipe={vi.fn()} />);
    expect(screen.getByText("Electricity")).toBeDefined();
    expect(screen.getByText("Water")).toBeDefined();
  });
});
