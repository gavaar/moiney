// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PipesList } from "./PipesList";
import { type Id } from "@convex/_generated/dataModel";

vi.mock("@/components/ui/PipeBox", () => ({
  PipeBox: (props: any) => (
    <button
      data-testid="feed-box"
      data-name={props.name}
      data-icon={props.icon}
      onClick={() => props.onPress?.()}
    >
      {props.name}
    </button>
  ),
}));

const mockPipes = [
  { _id: "1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", capacity: 0, fed: 0, spent: 0 },
  { _id: "2" as Id<"pipes">, name: "Salary", icon: "cash-outline", capacity: 0, fed: 0, spent: 0 },
];

describe("PipesList", () => {
  it("renders a PipeBox for each pipe", () => {
    render(<PipesList pipes={mockPipes} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes).toHaveLength(2);
  });

  it("passes correct props to each PipeBox", () => {
    render(<PipesList pipes={mockPipes} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes[0].getAttribute("data-name")).toBe("Groceries");
    expect(boxes[0].getAttribute("data-icon")).toBe("cart-outline");
    expect(boxes[1].getAttribute("data-name")).toBe("Salary");
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
        trailing={(pipe) => <span data-testid="trailing" data-pipe-id={pipe._id} />}
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
        leading={(pipe) => <span data-testid="leading" data-pipe-id={pipe._id} />}
      />,
    );
    const leading = screen.getAllByTestId("leading");
    expect(leading).toHaveLength(2);
    expect(leading[0].getAttribute("data-pipe-id")).toBe("1");
    expect(leading[1].getAttribute("data-pipe-id")).toBe("2");
  });
});
