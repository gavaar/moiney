// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";
import { AddPipeModal } from "./AddPipeModal";

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

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    pipesById: {},
    childrenByParent: new Map(),
  }),
}));

const parentId = "parent-1" as Id<"pipes">;
const onClose = vi.fn();

function renderModal(visible = true) {
  return render(<AddPipeModal visible={visible} onClose={onClose} parentId={parentId} />);
}

describe("AddPipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when not visible", () => {
    renderModal(false);
    expect(screen.queryByPlaceholderText("Pipe name")).toBeNull();
  });

  it("renders form fields when visible", () => {
    renderModal();
    expect(screen.getByPlaceholderText("Pipe name")).toBeDefined();
    expect(screen.getByText("Submit")).toBeDefined();
    expect(screen.queryByText("Cancel")).toBeNull();
  });

  it("resets form fields when reopened", async () => {
    const user = userEvent.setup();
    const { rerender } = renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "Food");
    rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    rerender(<AddPipeModal visible={true} onClose={onClose} parentId={parentId} />);
    const reopenedInput = screen.getByPlaceholderText("Pipe name") as HTMLInputElement;
    expect(reopenedInput.value).toBe("");
  });

  it("shows validation error when name is empty", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByText("Submit"));
    expect(screen.getByText("Name is required")).toBeDefined();
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("shows validation error when name is less than 3 characters", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "ab");
    await user.click(screen.getByText("Submit"));
    expect(screen.getByText("Name must be at least 3 characters")).toBeDefined();
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("calls addPipe mutation with form data on valid submit", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "Food");
    await user.click(screen.getByText("Submit"));
    await waitFor(() => {
      expect(mockAddPipe).toHaveBeenCalledWith({
        name: "Food",
        icon: "pipe",
        description: undefined,
        priority: 0,
        capacity: 0,
        parentId,
      });
    });
  });

  it("shows error and re-enables button on mutation failure", async () => {
    mockAddPipe.mockRejectedValueOnce(new Error("Server error"));
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "Food");
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
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "Food");
    await user.click(screen.getByText("Submit"));
    expect(screen.queryByText("Submit")).toBeNull();
    resolveMutation(undefined);
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it("calls onClose when the backdrop is pressed", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId("modal-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });
});
