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

const mockAllPipes = [
  { _id: "pipe-1" as Id<"pipes">, name: "Groceries", icon: "cart-outline", priority: 1, capacity: 1000, fed: 500, spent: 200, parentId: undefined },
  { _id: "pipe-2" as Id<"pipes">, name: "Salary", icon: "wallet-outline", priority: 2, capacity: 5000, fed: 3000, spent: 1000, parentId: undefined },
  { _id: "pipe-3" as Id<"pipes">, name: "Freelance", icon: "laptop-outline", priority: 3, capacity: 2000, fed: 1000, spent: 500, parentId: undefined },
  { _id: "child-1" as Id<"pipes">, name: "Child Budget", icon: "arrow", priority: 1, capacity: 500, fed: 200, spent: 100, parentId: "pipe-1" as Id<"pipes"> },
  { _id: "salary-child-1" as Id<"pipes">, name: "Eating Out", icon: "restaurant-outline", priority: 1, capacity: 300, fed: 150, spent: 50, parentId: "pipe-2" as Id<"pipes"> },
];

const mockChildrenByParent = new Map();
mockChildrenByParent.set("pipe-1" as Id<"pipes">, [
  { _id: "child-1" as Id<"pipes">, name: "Child Budget", icon: "arrow", priority: 1, capacity: 500, fed: 200, spent: 100, parentId: "pipe-1" as Id<"pipes"> },
]);
mockChildrenByParent.set("pipe-2" as Id<"pipes">, [
  { _id: "salary-child-1" as Id<"pipes">, name: "Eating Out", icon: "restaurant-outline", priority: 1, capacity: 300, fed: 150, spent: 50, parentId: "pipe-2" as Id<"pipes"> },
]);

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    feeds: mockAllPipes.filter((p: any) => !p.parentId),
    selectedPipe: mockAllPipes[0],
    allPipes: mockAllPipes,
    childrenByParent: mockChildrenByParent,
    pipesById: Object.fromEntries(mockAllPipes.map((p: any) => [p._id, p])),
  }),
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

  describe("From tree picker", () => {
    it("shows From label and trigger in modal", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      expect(screen.getByText("From (optional)")).toBeTruthy();
      expect(screen.getByTestId("from-trigger")).toBeTruthy();
    });

    it("opens tree picker modal on trigger press", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));
      await user.click(screen.getByTestId("from-trigger"));

      expect(screen.getByText("Salary")).toBeTruthy();
      expect(screen.getByText("Freelance")).toBeTruthy();
    });

    it("excludes current pipe and its subtree from the tree", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));
      await user.click(screen.getByTestId("from-trigger"));

      expect(screen.queryByText("Groceries")).toBeNull();
      expect(screen.queryByText("Child Budget")).toBeNull();
    });

    it("starts expanded showing all children", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));
      await user.click(screen.getByTestId("from-trigger"));

      expect(screen.getByText("Eating Out")).toBeTruthy();
    });

    it("collapses non-leaf pipe on tap hiding children", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));
      await user.click(screen.getByTestId("from-trigger"));

      expect(screen.getByText("Eating Out")).toBeTruthy();

      await user.click(screen.getByText("Salary"));

      expect(screen.queryByText("Eating Out")).toBeNull();
    });

    it("shows selected pipe name in trigger after selection", async () => {
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));
      await user.click(screen.getByTestId("from-trigger"));

      await user.click(screen.getByText("Freelance"));

      const trigger = screen.getByTestId("from-trigger");
      expect(trigger.textContent).toContain("Freelance");
    });

    it("console.logs fromFeedId and pipeId when From is selected and confirmed", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const user = userEvent.setup();
      render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

      await user.click(screen.getByTestId("feed-amount-trigger"));

      const input = screen.getByPlaceholderText("100.53");
      fireEvent.change(input, { target: { value: "100" } });

      await user.click(screen.getByTestId("from-trigger"));
      await user.click(screen.getByText("Freelance"));

      await user.click(screen.getByText("Feed"));

      expect(logSpy).toHaveBeenCalledWith({
        fromFeedId: "pipe-3",
        pipeId: PIPE_ID,
        amount: 100,
      });
      expect(mockFeedPipe).not.toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });
});