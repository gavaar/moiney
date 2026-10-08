// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";
import { FeedListScreen } from './FeedListScreen';
import type { PipeModel } from "@features/pipes/data/pipes";

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
const chooseTitle = vi.fn();
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@features/pipes/components/PipesList", () => ({
  PipesList: ({ pipes, onSelectPipe, compactAction, trailing, footer }: any) => (
    <div data-testid="pipes-list" data-count={pipes.length} onClickCapture={event => {
      // Model a background list's keyboard-dismiss capture across modal ancestry.
      if ((event.target as Element).closest('[data-testid="feed-title-choice"]')) event.stopPropagation();
    }}>
      <button
        data-testid="select-pipe"
         onClick={() => onSelectPipe?.(pipes[0].id)}
      >
        Select {pipes[0].name}
      </button>
      {compactAction?.label(pipes[0]) && <button onClick={() => compactAction.onPress(pipes[0])}>{compactAction.label(pipes[0])}</button>}
      {pipes.map((pipe: PipeModel) => <div key={pipe.id}>{trailing?.(pipe)}</div>)}
      {footer}
    </div>
  ),
}));

vi.mock("@features/pipes/FeedListScreen/components/FeedAmountModal", () => ({
  FeedAmountModal: ({ visible, onClose, hideTrigger, feedName }: any) => {
    const [localVisible, setVisible] = useState(false);
    return <div data-testid="feed-amount-modal">
      {!hideTrigger && <button aria-label={`Add money to ${feedName}`} onClick={() => setVisible(true)}>+</button>}
      {(visible ?? localVisible) && <>
        <button data-testid="feed-title-choice" onClick={chooseTitle}>Salary suggestion</button>
        <button onClick={() => { setVisible(false); onClose?.(); }}>Close feed form</button>
      </>}
    </div>;
  },
}));

vi.mock("@features/pipes/FeedListScreen/components/AddFeedButton", () => ({
  AddFeedButton: () => <div data-testid="add-feed-button">Add Feed</div>,
}));

const mockPipes = [
  { id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", capacity: 0, fed: 0, spent: 0 },
  { id: "pipe-2" as Id<"pipes">, name: "Salary", icon: "cash-outline", capacity: 0, fed: 0, spent: 0 },
] as PipeModel[];

describe("FeedListScreen", () => {
  beforeEach(() => chooseTitle.mockClear());

  it("opens the expanded feed's form outside background list keyboard capture", async () => {
    const userEvent = (await import("@testing-library/user-event")).default;
    const user = userEvent.setup();
    render(<FeedListScreen isLoading={false} pipes={mockPipes} onSelectFeed={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Add money to Salary" }));
    await user.click(screen.getByText("Salary suggestion"));
    expect(chooseTitle).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Close feed form" }));
    expect(screen.queryByText("Salary suggestion")).toBeNull();
  });
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
