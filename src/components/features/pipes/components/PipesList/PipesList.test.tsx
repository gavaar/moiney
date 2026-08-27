// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipesList } from "./PipesList";
import { type Id } from "@convex/_generated/dataModel";

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ childrenByParent: new Map() }),
}));

vi.mock("@features/pipes/components/PipeBox", () => ({
  PipeBox: (props: any) => (
    <button
      data-testid="feed-box"
      data-capacity={props.capacity}
      data-show-priority={props.showPriority ? "true" : "false"}
      onClick={() => props.onPress?.()}
    >
      {props.name}
    </button>
  ),
}));

const mockPipes = [
  { id: "1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
  { id: "2" as Id<"pipes">, name: "Salary", icon: "cash-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
];

describe("PipesList", () => {
  it("renders a PipeBox for each pipe", () => {
    render(<PipesList pipes={mockPipes} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes).toHaveLength(2);
  });

  it("uses contributed fed as a boiler card's visual baseline", () => {
    render(
      <PipesList
        pipes={[
          {
            ...mockPipes[0],
            sourceType: "boiler",
            contributedFed: 10000,
          },
        ]}
      />,
    );

    expect(screen.getByTestId("feed-box").getAttribute("data-capacity")).toBe(
      "10000",
    );
  });

  it("only shows priority markers when requested", () => {
    const pipes = [
      ...mockPipes,
      { id: "3" as Id<"pipes">, name: "Rent", icon: "home-outline", priority: 1, capacity: 0, fed: 0, spent: 0 },
    ];

    const { rerender } = render(<PipesList pipes={pipes} />);
    expect(screen.getAllByTestId("feed-box").map((box) => box.getAttribute("data-show-priority")))
      .toEqual(["false", "false", "false"]);

    rerender(<PipesList pipes={pipes} priority />);
    expect(screen.getAllByTestId("feed-box").map((box) => box.getAttribute("data-show-priority")))
      .toEqual(["true", "false", "true"]);
  });

  it("calls onSelectPipe when a PipeBox is pressed", async () => {
    const user = userEvent.setup();
    const onSelectPipe = vi.fn();
    render(<PipesList pipes={mockPipes} onSelectPipe={onSelectPipe} />);

    await user.click(screen.getAllByTestId("feed-box")[0]);
    expect(onSelectPipe).toHaveBeenCalledWith("1");
  });

  it("renders trailing element for each pipe when provided", () => {
    render(
      <PipesList
        pipes={mockPipes}
        trailing={(pipe) => <span data-testid="trailing" data-pipe-id={pipe.id} />}
      />,
    );
    const trailing = screen.getAllByTestId("trailing");
    expect(trailing).toHaveLength(2);
    expect(trailing[0].getAttribute("data-pipe-id")).toBe("1");
    expect(trailing[1].getAttribute("data-pipe-id")).toBe("2");
  });

  it("renders leading element for each pipe when provided", () => {
    render(
      <PipesList
        pipes={mockPipes}
        leading={(pipe) => <span data-testid="leading" data-pipe-id={pipe.id} />}
      />,
    );
    const leading = screen.getAllByTestId("leading");
    expect(leading).toHaveLength(2);
    expect(leading[0].getAttribute("data-pipe-id")).toBe("1");
    expect(leading[1].getAttribute("data-pipe-id")).toBe("2");
  });
});
