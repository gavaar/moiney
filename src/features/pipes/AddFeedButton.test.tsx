// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByTestId("icon-picker-trigger"));
    await user.click(screen.getByText("wallet-outline"));

    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(mockAddFeed).toHaveBeenCalledWith({
        name: "Food",
        icon: "wallet-outline",
        description: undefined,
      });
    });
  });

  it("shows success alert and closes modal on successful submit", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

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

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Add"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Error", "Server error");
    });
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));
    await user.click(screen.getByText("Add"));

    expect(screen.getByText("Name is required")).toBeDefined();
    expect(mockAddFeed).not.toHaveBeenCalled();
  });

  it("shows validation error when name is less than 2 characters", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "a");

    await user.click(screen.getByText("Add"));

    expect(
      screen.getByText("Name must be at least 2 characters"),
    ).toBeDefined();
    expect(mockAddFeed).not.toHaveBeenCalled();
  });

  it("clears validation error when user types after failed submit", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));
    await user.click(screen.getByText("Add"));

    expect(screen.getByText("Name is required")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("Feed name");
    await user.type(nameInput, "F");

    expect(screen.queryByText("Name is required")).toBeNull();
  });

  it("re-validates name on blur after typing", async () => {
    const user = userEvent.setup();
    render(<AddFeedButton />);

    await user.click(screen.getByText("Add new Feed"));
    await user.click(screen.getByText("Add"));

    expect(screen.getByText("Name is required")).toBeDefined();

    const nameInput = screen.getByPlaceholderText("Feed name");

    await user.type(nameInput, "F");
    expect(screen.queryByText("Name is required")).toBeNull();

    fireEvent.blur(nameInput);

    expect(
      screen.getByText("Name must be at least 2 characters"),
    ).toBeDefined();
  });
});
