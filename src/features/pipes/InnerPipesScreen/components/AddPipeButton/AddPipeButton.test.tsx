// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AddPipeButton } from "./AddPipeButton";

const mockAddPipe = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockAddPipe,
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {
      addPipe: {},
    },
  },
}));

const parentId = "parent-1";

describe("AddPipeButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the add pipe button", () => {
    render(<AddPipeButton parentId={parentId} />);
    expect(screen.getByText("Add pipe")).toBeDefined();
  });

  it("opens modal with form fields on tap", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    expect(screen.getByPlaceholderText("Pipe name")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
    expect(screen.getByText("Cancel")).toBeDefined();
  });

  it("resets form fields when cancel is pressed", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Cancel"));

    await user.click(screen.getByText("Add pipe"));

    const reopenedInput = screen.getByPlaceholderText("Pipe name") as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));
    await user.click(screen.getByText("Submit"));

    expect(screen.getByText("Name is required")).toBeDefined();
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("shows validation error when name is less than 3 characters", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "ab");

    await user.click(screen.getByText("Submit"));

    expect(
      screen.getByText("Name must be at least 3 characters"),
    ).toBeDefined();
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("calls addPipe mutation with form data on valid submit", async () => {
    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(mockAddPipe).toHaveBeenCalledWith({
        name: "Food",
        icon: "pipe",
        description: undefined,
        priority: 0,
        capacity: undefined,
        parentId,
      });
    });
  });

  it("shows error and re-enables button on mutation failure", async () => {
    mockAddPipe.mockRejectedValueOnce(new Error("Server error"));

    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Submit"));

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeDefined();
    });

    expect(screen.getByText("Submit")).toBeDefined();
  });

  it("shows loading state while mutation is in flight", async () => {
    let resolveMutation!: (value: unknown) => void;
    mockAddPipe.mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve;
      }),
    );

    const user = userEvent.setup();
    render(<AddPipeButton parentId={parentId} />);

    await user.click(screen.getByText("Add pipe"));

    const nameInput = screen.getByPlaceholderText("Pipe name");
    await user.type(nameInput, "Food");

    await user.click(screen.getByText("Submit"));

    expect(screen.queryByText("Submit")).toBeNull();

    resolveMutation(undefined);

    await waitFor(() => {
      expect(screen.getByText("Add pipe")).toBeDefined();
    });
  });
});
