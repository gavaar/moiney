// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";
import { FeedListScreen } from './FeedListScreen';

vi.mock("@/features/pipes/FeedListScreen/components/FeedList", () => ({
  FeedList: ({ pipes, onSelectFeed }: any) => (
    <div data-testid="feed-list" data-count={pipes.length}>
      <button
        data-testid="select-feed"
        onClick={() => onSelectFeed?.(pipes[0]._id)}
      >
        Select {pipes[0].name}
      </button>
    </div>
  ),
}));

vi.mock("@/features/pipes/FeedListScreen/components/AddFeedButton", () => ({
  AddFeedButton: () => <div data-testid="add-feed-button">Add Feed</div>,
}));

const mockPipes = [
  { _id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", capacity: 0, fed: 0, spent: 0 },
  { _id: "pipe-2" as Id<"pipes">, name: "Salary", icon: "cash-outline", capacity: 0, fed: 0, spent: 0 },
];

describe("FeedListScreen", () => {
  it("renders loading spinner and AddFeedButton when isLoading is true", () => {
    const { container } = render(
      <FeedListScreen
        isLoading={true}
        pipes={[]}
        onSelectFeed={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("feed-list")).toBeNull();
    expect(screen.getByTestId("add-feed-button")).toBeDefined();
    expect(container.querySelector("[data-testid=loading-indicator]")).toBeTruthy();
  });

  it("renders FeedList and AddFeedButton when pipes exist", () => {
    render(
      <FeedListScreen
        isLoading={false}
        pipes={mockPipes}
        onSelectFeed={vi.fn()}
      />,
    );
    expect(screen.getByTestId("feed-list")).toBeDefined();
    expect(screen.getByTestId("add-feed-button")).toBeDefined();
  });

  it("renders empty state when pipes is empty", () => {
    render(
      <FeedListScreen
        isLoading={false}
        pipes={[]}
        onSelectFeed={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("feed-list")).toBeNull();
    expect(screen.getByTestId("add-feed-button")).toBeDefined();
    expect(screen.getByText(/add your first/i)).toBeDefined();
  });

  it("calls onSelectFeed when a feed is selected from FeedList", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const onSelectFeed = vi.fn();
    render(
      <FeedListScreen
        isLoading={false}
        pipes={mockPipes}
        onSelectFeed={onSelectFeed}
      />,
    );
    await userEvent.click(screen.getByTestId("select-feed"));
    expect(onSelectFeed).toHaveBeenCalledWith("pipe-1");
  });
});
