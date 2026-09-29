// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";
import { FeedListScreen } from './FeedListScreen';
import type { PipeModel } from "@features/pipes/data/pipes";

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@features/pipes/components/PipesList", () => ({
  PipesList: ({ pipes, onSelectPipe, compactAction, footer }: any) => (
    <div data-testid="pipes-list" data-count={pipes.length}>
      <button
        data-testid="select-pipe"
         onClick={() => onSelectPipe?.(pipes[0].id)}
      >
        Select {pipes[0].name}
      </button>
      {compactAction?.label(pipes[0]) && <button onClick={() => compactAction.onPress(pipes[0])}>{compactAction.label(pipes[0])}</button>}
      {footer}
    </div>
  ),
}));

vi.mock("@features/pipes/FeedListScreen/components/FeedAmountModal", () => ({
  FeedAmountModal: ({ visible, onClose }: any) => <div data-testid="feed-amount-modal">{visible && <button onClick={onClose}>Close feed form</button>}</div>,
}));

vi.mock("@features/pipes/FeedListScreen/components/AddFeedButton", () => ({
  AddFeedButton: () => <div data-testid="add-feed-button">Add Feed</div>,
}));

const mockPipes = [
  { id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", capacity: 0, fed: 0, spent: 0 },
  { id: "pipe-2" as Id<"pipes">, name: "Salary", icon: "cash-outline", capacity: 0, fed: 0, spent: 0 },
] as PipeModel[];

describe("FeedListScreen", () => {
  it("opens and closes the feed form from a minimized feed's menu action", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(<FeedListScreen isLoading={false} pipes={mockPipes} onSelectFeed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add money" }));
    expect(screen.getByRole("button", { name: "Close feed form" })).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Close feed form" }));
    expect(screen.queryByRole("button", { name: "Close feed form" })).toBeNull();
  });
  it("renders only the loading state while the initial query is pending", () => {
    const { container } = render(
      <FeedListScreen
        isLoading={true}
        pipes={[]}
        onSelectFeed={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("pipes-list")).toBeNull();
    expect(screen.queryByTestId("add-feed-button")).toBeNull();
    expect(container.querySelector("[data-testid=loading-indicator]")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Loading feeds" })).toBeTruthy();
  });

  it("renders PipesList and AddFeedButton when pipes exist", () => {
    render(
      <FeedListScreen
        isLoading={false}
        pipes={mockPipes}
        onSelectFeed={vi.fn()}
      />,
    );
    expect(screen.getByTestId("pipes-list")).toBeDefined();
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
    expect(screen.queryByTestId("pipes-list")).toBeNull();
    expect(screen.getByTestId("add-feed-button")).toBeDefined();
    expect(screen.getByText(/add your first/i)).toBeDefined();
  });

  it("calls onSelectFeed when a pipe is selected from PipesList", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const onSelectFeed = vi.fn();
    render(
      <FeedListScreen
        isLoading={false}
        pipes={mockPipes}
        onSelectFeed={onSelectFeed}
      />,
    );
    await userEvent.click(screen.getByTestId("select-pipe"));
    expect(onSelectFeed).toHaveBeenCalledWith("pipe-1");
  });
});
