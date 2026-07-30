// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { type Id } from "@convex/_generated/dataModel";
import { FeedAmountModal } from "./FeedAmountModal";

const PIPE_ID = "pipe-1" as Id<"pipes">;

const mockOnSuccess = vi.fn();
let capturedOnSuccess: (() => void) | null = null;

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: ({ onSuccess, variant }: any) => {
    capturedOnSuccess = onSuccess;
    return <div data-testid="amount-form" data-mode={variant} />;
  },
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

describe("FeedAmountModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedOnSuccess = null;
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

  it("renders AmountForm with feed mode inside modal", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    const form = screen.getByTestId("amount-form");
    expect(form).toBeTruthy();
    expect(form.getAttribute("data-mode")).toBe("feed");
  });

  it("shows success alert and closes modal when AmountForm succeeds", async () => {
    const user = userEvent.setup();
    render(<FeedAmountModal pipeId={PIPE_ID} feedName="Groceries" />);

    await user.click(screen.getByTestId("feed-amount-trigger"));

    expect(capturedOnSuccess).not.toBeNull();
    capturedOnSuccess!();

    expect(mockShowAlert.success).toHaveBeenCalledWith("Feed added");
  });
});
