// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { type Id } from "@convex/_generated/dataModel";
import { FeedAmountModal } from "./FeedAmountModal";

const PIPE_ID = "pipe-1" as Id<"pipes">;

const mockFeedPipe = vi.fn().mockResolvedValue(undefined);
const mockListRecentTitles = vi.fn().mockReturnValue([]);

vi.mock("convex/react", () => ({
  useMutation: () => mockFeedPipe,
  useQuery: () => mockListRecentTitles(),
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {
      feedPipe: {},
    },
    transactions: {
      listRecentTitles: {},
    },
  },
}));

vi.mock("@ui/Input", () => ({
  Input: ({ type, value, onChangeText, onChange, placeholder, ...props }: any) => {
    const handleChange = onChangeText || onChange;
    return (
      <input
        data-testid={`mock-input-${type}`}
        placeholder={placeholder}
        value={value}
        onChange={(e) => handleChange?.(e.target.value)}
        {...props}
      />
    );
  },
}));

describe("FeedAmountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListRecentTitles.mockReturnValue([]);
  });

  it("renders the add icon trigger", () => {
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);
    expect(screen.getByTestId("feed-amount-trigger")).toBeTruthy();
  });

  it("opens modal on trigger press", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    expect(screen.getByText("Feed Groceries")).toBeTruthy();
  });

  it("renders title input and amount input in modal", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    expect(screen.getByPlaceholderText("What was this for?")).toBeTruthy();
    expect(screen.getByPlaceholderText("100.53")).toBeTruthy();
  });

  it("does not call feedPipe when confirm is pressed with empty title", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "50" } });

    await user.click(screen.getByText("Feed"));

    expect(mockFeedPipe).not.toHaveBeenCalled();
  });

  it("does not call feedPipe when amount is 0", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "groceries" } });

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "0" } });

    await user.click(screen.getByText("Feed"));

    expect(mockFeedPipe).not.toHaveBeenCalled();
  });

  it("calls feedPipe with pipeId, amount and title on confirm", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "groceries" } });

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "100.53" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockFeedPipe).toHaveBeenCalledWith({
        pipeId: PIPE_ID,
        amount: 100.53,
        title: "groceries",
      });
    });
  });

  it("rounds amount to 2 decimal places", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "groceries" } });

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "100.536" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockFeedPipe).toHaveBeenCalledWith({
        pipeId: PIPE_ID,
        amount: 100.54,
        title: "groceries",
      });
    });
  });

  it("shows success alert and closes modal on successful submit", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "groceries" } });

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "50" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockFeedPipe).toHaveBeenCalled();
    });

    expect(mockShowAlert.success).toHaveBeenCalledWith("Feed added");
  });

  it("shows error alert and keeps modal open on mutation failure", async () => {
    mockFeedPipe.mockRejectedValueOnce(new Error("Not authorized"));

    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const titleInput = screen.getByPlaceholderText("What was this for?");
    fireEvent.change(titleInput, { target: { value: "groceries" } });

    const amountInput = screen.getByPlaceholderText("100.53");
    fireEvent.change(amountInput, { target: { value: "50" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockShowAlert.error).toHaveBeenCalledWith("Not authorized");
    });
  });
});
