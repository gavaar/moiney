// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";
import { AddPipeModal } from "./AddPipeModal";
import type { PipeModel } from "@features/pipes/data/pipes";

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
  usePipeCatalog: () => catalog,
}));

const parentId = "parent-1" as Id<"pipes">;
const otherId = "parent-2" as Id<"pipes">;
const owner: PipeModel = { id: parentId, name: "Wallet", icon: "wallet-outline", priority: 0, capacity: 10000, spent: 2000, fed: 8000 };
const other: PipeModel = { ...owner, id: otherId, name: "Savings", icon: "pipe", capacity: 0, spent: 0, sourceType: "boiler" };
let catalog = {
  allPipes: [owner, other] as PipeModel[] | undefined,
  pipesById: { [parentId]: owner, [otherId]: other },
  childrenByParent: new Map<Id<"pipes">, PipeModel[]>([[otherId, [{ ...owner, id: "child" as Id<"pipes"> }]]]),
  isLoading: false,
};
const onClose = vi.fn();

function renderModal(visible = true) {
  return render(<AddPipeModal visible={visible} onClose={onClose} parentId={parentId} />);
}

describe("AddPipeModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddPipe.mockResolvedValue(undefined);
    catalog.allPipes = [owner, other];
    catalog.isLoading = false;
  });

  it("starts without an owner, selects inline, advances, and allows returning to the selected row", async () => {
    render(<AddPipeModal visible onClose={onClose} />);
    expect(screen.getByRole("heading", { name: "Select owner pipe" })).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Wallet" }));
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByRole("radio", { name: "Wallet" }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
    await userEvent.click(screen.getByRole("radio", { name: "Wallet" }));
    expect(screen.getByRole("textbox", { name: "Name" })).toBeTruthy();
  });

  it("preserves details when changing owner and submits to that owner with signed capacity", async () => {
    renderModal();
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeTruthy();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Food" } });
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("radio", { name: "Savings" }));
    expect(screen.getByDisplayValue("Food")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Savings" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.queryByText(/Creating a child will remove/)).toBeNull();
    expect(screen.queryByText(/Adding a pipe removes/)).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Initial capacity?" }), { target: { value: "-12.34" } });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(mockAddPipe).toHaveBeenCalledWith(expect.objectContaining({ name: "Food", parentId: otherId, capacity: -1234 }));
  });

  it("shows warnings for a childless owner and rejects incomplete capacity", async () => {
    renderModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Food" } });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByText(/Creating a child will remove/)).toBeTruthy();
    expect(screen.getByText(/Adding a pipe removes/)).toBeTruthy();
    const input = screen.getByRole("textbox", { name: "Initial capacity?" });
    fireEvent.change(input, { target: { value: "-" } });
    fireEvent.blur(input);
    expect(screen.getByRole("alert").textContent).toBe("Enter a valid capacity");
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("shows loading and empty owner lists and excludes deleting pipes", () => {
    catalog.isLoading = true;
    catalog.allPipes = undefined;
    const { rerender } = render(<AddPipeModal visible onClose={onClose} />);
    expect(screen.getByLabelText("Loading Owner pipe")).toBeTruthy();
    catalog.isLoading = false;
    catalog.allPipes = [{ ...owner, deletionJobId: "job" as Id<"pipeDeletionJobs"> }];
    rerender(<AddPipeModal visible onClose={onClose} />);
    expect(screen.getByText("No options")).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("cannot submit without an eligible owner even after completing the other steps", async () => {
    render(<AddPipeModal visible onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Food" } });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("disables submission if the selected owner becomes unavailable", async () => {
    const { rerender } = renderModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: "Food" } });
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    catalog.allPipes = [other];
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("heading", { name: "Select owner pipe" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("resets owner selection, step, draft, and validation when reopened", async () => {
    const { rerender } = renderModal();
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    await userEvent.click(screen.getByRole("radio", { name: "Savings" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    rerender(<AddPipeModal visible={false} onClose={onClose} parentId={parentId} />);
    rerender(<AddPipeModal visible onClose={onClose} parentId={parentId} />);
    expect(screen.getByRole("heading", { name: "Wallet" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Name" }).getAttribute("value")).toBe("");
    expect(screen.getByLabelText("Step 2 of 3").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it.each([["0", 0], ["12.34", 1234]] as const)("submits capacity %s as integer cents", async (capacity, cents) => {
    renderModal();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), { target: { value: " Food " } });
    fireEvent.change(screen.getByRole("textbox", { name: "Description" }), { target: { value: "Lunch budget" } });
    await userEvent.click(screen.getByRole("button", { name: "Increase Priority" }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Initial capacity?" }), { target: { value: capacity } });
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(mockAddPipe).toHaveBeenCalledExactlyOnceWith({ parentId, name: "Food", description: "Lunch budget", icon: "pipe", priority: 1, capacity: cents });
  });

  it("renders nothing when not visible", () => {
    renderModal(false);
    expect(screen.queryByPlaceholderText("Pipe name")).toBeNull();
  });

  it("renders form fields when visible", () => {
    renderModal();
    expect(screen.getByPlaceholderText("Pipe name")).toBeDefined();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Priority" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Icon" })).toBeTruthy();
    expect(screen.getByLabelText("Step 2 of 3").getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByText("Submit")).toBeNull();
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
    expect(screen.queryByText("Name is required")).toBeNull();
    await user.click(screen.getByPlaceholderText("Pipe name"));
    await user.tab();
    expect(screen.getByText("Name is required")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("shows validation error when name is less than 3 characters", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "ab");
    expect(screen.queryByText("Name must be at least 3 characters")).toBeNull();
    await user.tab();
    expect(screen.getByText("Name must be at least 3 characters")).toBeDefined();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getByRole("button", { name: "Submit" }).getAttribute("aria-disabled")).toBe("true");
    expect(mockAddPipe).not.toHaveBeenCalled();
  });

  it("keeps an error visible during invalid corrections and clears it as soon as valid", async () => {
    const user = userEvent.setup();
    renderModal();
    const input = screen.getByPlaceholderText("Pipe name");
    await user.click(input);
    await user.tab();
    await user.type(input, "a");
    expect(screen.getByRole("alert").textContent).toBe("Name must be at least 3 characters");
    await user.type(input, "bc");
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("calls addPipe mutation with form data on valid submit", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.type(screen.getByPlaceholderText("Pipe name"), "Food");
    await user.click(screen.getByRole("button", { name: "Next" }));
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
    await user.click(screen.getByRole("button", { name: "Next" }));
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
    await user.click(screen.getByRole("button", { name: "Next" }));
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
