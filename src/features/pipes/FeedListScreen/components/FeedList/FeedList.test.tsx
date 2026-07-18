// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeedList } from "./FeedList";

vi.mock("@/components/ui/FeedBox", () => ({
  FeedBox: (props: any) => (
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

vi.mock("./components/FeedAmountModal", () => ({
  FeedAmountModal: () => <div data-testid="feed-amount-modal" />,
}));

import { type Id } from "@convex/_generated/dataModel";

const mockPipes = [
  { _id: "1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", description: "Food", capacity: 0, fed: 0, spent: 0 },
  { _id: "2" as Id<"pipes">, name: "Salary", icon: "cash-outline", description: undefined, capacity: 0, fed: 0, spent: 0 },
];

describe("FeedList", () => {
  it("renders a FeedBox for each pipe", () => {
    render(<FeedList pipes={mockPipes} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes).toHaveLength(2);
  });

  it("passes correct props to each FeedBox", () => {
    render(<FeedList pipes={mockPipes} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes[0].getAttribute("data-name")).toBe("Groceries");
    expect(boxes[0].getAttribute("data-icon")).toBe("cart-outline");
    expect(boxes[1].getAttribute("data-name")).toBe("Salary");
  });

  it("calls onSelectFeed with the feed id when a FeedBox is pressed", async () => {
    const user = userEvent.setup();
    const onSelectFeed = vi.fn();
    render(<FeedList pipes={mockPipes} onSelectFeed={onSelectFeed} />);

    await user.click(screen.getAllByTestId("feed-box")[0]);
    expect(onSelectFeed).toHaveBeenCalledWith("1");
  });
});
