// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedList } from "./FeedList";

vi.mock("@/components/ui/FeedBox", () => ({
  FeedBox: (props: any) => (
    <div data-testid="feed-box" data-name={props.name} data-icon={props.icon}>
      {props.name}
    </div>
  ),
}));

vi.mock("./components/FeedAmountModal", () => ({
  FeedAmountModal: () => <div data-testid="feed-amount-modal" />,
}));

import { type Id } from "@convex/_generated/dataModel";

const mockFeeds = [
  { _id: "1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", description: "Food", capacity: 0, fed: 0, spent: 0 },
  { _id: "2" as Id<"pipes">, name: "Salary", icon: "cash-outline", description: undefined, capacity: 0, fed: 0, spent: 0 },
];

describe("FeedList", () => {
  it("renders a FeedBox for each feed", () => {
    render(<FeedList feeds={mockFeeds} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes).toHaveLength(2);
  });

  it("passes correct props to each FeedBox", () => {
    render(<FeedList feeds={mockFeeds} />);
    const boxes = screen.getAllByTestId("feed-box");
    expect(boxes[0].getAttribute("data-name")).toBe("Groceries");
    expect(boxes[0].getAttribute("data-icon")).toBe("cart-outline");
    expect(boxes[1].getAttribute("data-name")).toBe("Salary");
  });
});
