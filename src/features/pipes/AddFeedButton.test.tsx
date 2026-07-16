// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Alert } from "react-native";
import AddFeedButton from "./AddFeedButton";

const mockAddFeed = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockAddFeed,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {
      addFeed: {},
    },
  },
}));

describe("AddFeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  it("calls addFeed mutation with form data on submit", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalledWith({
        name: "",
        icon: "wallet-outline",
        description: undefined,
      });
    });
  });

  it("shows success alert and closes modal on successful submit", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));
    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalled();
    });

    expect(Alert.alert).toHaveBeenCalledWith("Success", "Feed added");
  });

  it("shows error alert and keeps modal open on mutation failure", async () => {
    mockAddFeed.mockRejectedValueOnce(new Error("Server error"));

    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));
    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Server error");
    });
  });
});
