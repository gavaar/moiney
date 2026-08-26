// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AddFeedButton } from "./AddFeedButton";

const mockAddFeed = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockAddFeed,
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {
      addFeed: {},
    },
  },
}));

const openModal = async () => {
  const user = userEvent.setup();
  render(<AddFeedButton />);
  await user.click(screen.getByText("Add new Feed"));
  return user;
};

describe("AddFeedButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls addFeed mutation with form data on submit", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    await user.click(screen.getByText("Add feed"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalledWith({
        name: "Food",
        icon: "wallet-outline",
        description: undefined,
        sourceType: "feed",
      });
    });
  });

  it("submits a boiler when the boiler type is selected", async () => {
    const user = await openModal();

    await user.click(screen.getByTestId("slide-toggle-boiler"));
    await user.type(screen.getByPlaceholderText("Feed name"), "Savings");
    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));
    await user.click(screen.getByText("Add boiler"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalledWith({
        name: "Savings",
        icon: "wallet-outline",
        description: undefined,
        sourceType: "boiler",
      });
    });
  });

  it("shows success alert and closes modal on successful submit", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    await user.click(screen.getByText("Add feed"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalled();
    });

    expect(mockShowAlert.success).toHaveBeenCalledWith("Feed added");
  });

  it("shows error alert and keeps modal open on mutation failure", async () => {
    mockAddFeed.mockRejectedValueOnce(new Error("Server error"));

    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    await user.click(screen.getByText("Add feed"));

    await waitFor(() => {
      expect(mockShowAlert.error).toHaveBeenCalledWith("Server error");
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText("Name is required")).toBeDefined();
    expect(mockAddFeed).not.toHaveBeenCalled();
  });

  it("shows validation error when name is less than 2 characters", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "a");
    await user.click(nameInput);
    await user.tab();

    expect(
      screen.getByText("Name must be at least 2 characters"),
    ).toBeDefined();
    expect(mockAddFeed).not.toHaveBeenCalled();
  });

  it("clears validation error when user types after blurring empty name", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.click(nameInput);
    await user.tab();

    expect(screen.getByText("Name is required")).toBeDefined();

    await user.type(nameInput, "F");

    expect(screen.queryByText("Name is required")).toBeNull();
  });

  it("re-validates name on blur after typing", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");

    await user.click(nameInput);
    await user.tab();
    expect(screen.getByText("Name is required")).toBeDefined();

    await user.type(nameInput, "F");
    expect(screen.queryByText("Name is required")).toBeNull();

    await user.click(nameInput);
    await user.tab();

    expect(
      screen.getByText("Name must be at least 2 characters"),
    ).toBeDefined();
  });

  it("disables Add button when form is empty", async () => {
    await openModal();

    const btn = screen.getByTestId("add-feed-submit");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("disables Add button with a valid name but no icon", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    const btn = screen.getByTestId("add-feed-submit");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
  });

  it("enables Add button when name and icon are provided", async () => {
    const user = await openModal();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    const btn = screen.getByTestId("add-feed-submit");
    expect(btn.getAttribute("aria-disabled")).toBeNull();
  });
});
