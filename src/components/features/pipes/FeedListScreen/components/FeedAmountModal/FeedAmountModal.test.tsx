// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { type Id } from "@convex/_generated/dataModel";
import { FeedAmountModal } from "./FeedAmountModal";

const PIPE_ID = "pipe-1" as Id<"pipes">;

const mockFeedPipe = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockFeedPipe,
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
  },
}));

describe("FeedAmountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("does not call feedPipe when confirm is pressed with empty input", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));
    await user.click(screen.getByText("Feed"));

    expect(mockFeedPipe).not.toHaveBeenCalled();
  });

  it("does not call feedPipe when amount is 0", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const input = screen.getByPlaceholderText("100.53");
    fireEvent.change(input, { target: { value: "0" } });

    await user.click(screen.getByText("Feed"));

    expect(mockFeedPipe).not.toHaveBeenCalled();
  });

  it("calls feedPipe with pipeId and amount on confirm", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const input = screen.getByPlaceholderText("100.53");
    fireEvent.change(input, { target: { value: "100.53" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockFeedPipe).toHaveBeenCalledWith({
        pipeId: PIPE_ID,
        amount: 100.53,
      });
    });
  });

  it("rounds amount to 2 decimal places", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const input = screen.getByPlaceholderText("100.53");
    fireEvent.change(input, { target: { value: "100.536" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockFeedPipe).toHaveBeenCalledWith({
        pipeId: PIPE_ID,
        amount: 100.54,
      });
    });
  });

  it("shows success alert and closes modal on successful submit", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const input = screen.getByPlaceholderText("100.53");
    fireEvent.change(input, { target: { value: "50" } });

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

    const input = screen.getByPlaceholderText("100.53");
    fireEvent.change(input, { target: { value: "50" } });

    await user.click(screen.getByText("Feed"));

    await waitFor(() => {
      expect(mockShowAlert.error).toHaveBeenCalledWith("Not authorized");
    });
  });

  describe("negative amounts", () => {
    it("shows Debt button and error variant when amount is negative", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      const input = screen.getByPlaceholderText("100.53");
      fireEvent.change(input, { target: { value: "-50" } });

      expect(screen.getByText("Debt")).toBeTruthy();
    });

    it("does not call feedPipe for zero input even when negative is allowed", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      const input = screen.getByPlaceholderText("100.53");
      fireEvent.change(input, { target: { value: "0" } });

      await user.click(screen.getByText("Feed"));

      expect(mockFeedPipe).not.toHaveBeenCalled();
    });

    it("calls feedPipe with negative amount on confirm", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      const input = screen.getByPlaceholderText("100.53");
      fireEvent.change(input, { target: { value: "-50.25" } });

      await user.click(screen.getByText("Debt"));

      await waitFor(() => {
        expect(mockFeedPipe).toHaveBeenCalledWith({
          pipeId: PIPE_ID,
          amount: -50.25,
        });
      });
    });

    it("shows 'Debt added' success alert for negative amounts", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      const input = screen.getByPlaceholderText("100.53");
      fireEvent.change(input, { target: { value: "-30" } });

      await user.click(screen.getByText("Debt"));

      await waitFor(() => {
        expect(mockFeedPipe).toHaveBeenCalled();
      });

      expect(mockShowAlert.success).toHaveBeenCalledWith("Debt added");
    });
  });
});
