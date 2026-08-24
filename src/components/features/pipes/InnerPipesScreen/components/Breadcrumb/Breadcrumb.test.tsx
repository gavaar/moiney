// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Breadcrumb } from "./Breadcrumb";

const mockUsePipeSelection = vi.fn();

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
}));

describe("Breadcrumb", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pipe icon and one item name", () => {
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1"],
      allPipes: [{ id: "pipe-1", name: "Groceries" }],
      selectPipe: vi.fn(),
    });
    render(<Breadcrumb />);
    expect(screen.getByTestId("breadcrumb-home")).toBeDefined();
    expect(screen.getByText("Groceries")).toBeDefined();
  });

  it("renders items separated by separators", () => {
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1", "pipe-2"],
      allPipes: [
        { id: "pipe-1", name: "Groceries" },
        { id: "pipe-2", name: "Salary" },
      ],
      selectPipe: vi.fn(),
    });
    render(<Breadcrumb />);
    expect(screen.getByText("Groceries")).toBeDefined();
    expect(screen.getByText("Salary")).toBeDefined();
    expect(screen.getAllByText("›").length).toBe(2);
  });

  it("calls selectPipe with empty array when pipe icon is pressed", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1", "pipe-2"],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<Breadcrumb />);
    await user.click(screen.getByTestId("breadcrumb-home"));
    expect(selectPipe).toHaveBeenCalledWith([]);
  });

  it("gives the root navigation control an accessible name", () => {
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1"],
      allPipes: [{ id: "pipe-1", name: "Groceries" }],
      selectPipe: vi.fn(),
    });
    render(<Breadcrumb />);
    expect(screen.getByRole("button", { name: "Go to pipe root" })).toBeDefined();
  });

  it("calls selectPipe with single-item path when first item is pressed", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1", "pipe-2", "pipe-3"],
      allPipes: [
        { id: "pipe-1", name: "Groceries" },
      ],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<Breadcrumb />);
    await user.click(screen.getByText("Groceries"));
    expect(selectPipe).toHaveBeenCalledWith(["pipe-1"]);
  });

  it("calls selectPipe with trimmed path when middle item is pressed", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      selectedPipePath: ["pipe-1", "pipe-2", "pipe-3"],
      allPipes: [
        { id: "pipe-1", name: "Groceries" },
        { id: "pipe-2", name: "Salary" },
      ],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<Breadcrumb />);
    await user.click(screen.getByText("Salary"));
    expect(selectPipe).toHaveBeenCalledWith(["pipe-1", "pipe-2"]);
  });
});
