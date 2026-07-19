// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InnerPipesScreen } from './InnerPipesScreen';

const mockUsePipeSelection = vi.fn();

vi.mock("@/features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

const baseMock = {
  selectedPipePath: [],
  allPipes: [],
  selectPipe: vi.fn(),
  selectedName: null,
};

describe("InnerPipesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the selected pipe name", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      allPipes: [{ _id: "pipe-1", name: "Groceries" }],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByText(/selected Groceries/i)).toBeDefined();
  });

  it("renders breadcrumb with home icon and one pipe name", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      allPipes: [{ _id: "pipe-1", name: "Groceries" }],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByTestId("breadcrumb-home")).toBeDefined();
    expect(screen.getByText("Groceries")).toBeDefined();
  });

  it("renders breadcrumb with multiple pipe names separated by separators", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1", "pipe-2"],
      allPipes: [
        { _id: "pipe-1", name: "Groceries" },
        { _id: "pipe-2", name: "Salary" },
      ],
      selectedName: "Salary",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByTestId("breadcrumb-home")).toBeDefined();
    expect(screen.getByText("Groceries")).toBeDefined();
    expect(screen.getByText("Salary")).toBeDefined();
    expect(screen.getAllByText("›").length).toBe(2);
  });

  it("calls selectPipe with empty array when home icon is pressed", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1", "pipe-2"],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<InnerPipesScreen />);
    await user.click(screen.getByTestId("breadcrumb-home"));
    expect(selectPipe).toHaveBeenCalledWith([]);
  });

  it("calls selectPipe with trimmed path when first breadcrumb item is pressed", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1", "pipe-2", "pipe-3"],
      allPipes: [
        { _id: "pipe-1", name: "Groceries" },
        { _id: "pipe-2", name: "Salary" },
        { _id: "pipe-3", name: "Rent" },
      ],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<InnerPipesScreen />);
    await user.click(screen.getByText("Groceries"));
    expect(selectPipe).toHaveBeenCalledWith(["pipe-1"]);
  });

  it("calls selectPipe with path up to the clicked middle item", async () => {
    const selectPipe = vi.fn();
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1", "pipe-2", "pipe-3"],
      allPipes: [
        { _id: "pipe-1", name: "Groceries" },
        { _id: "pipe-2", name: "Salary" },
        { _id: "pipe-3", name: "Rent" },
      ],
      selectPipe,
    });
    const user = userEvent.setup();
    render(<InnerPipesScreen />);
    await user.click(screen.getByText("Salary"));
    expect(selectPipe).toHaveBeenCalledWith(["pipe-1", "pipe-2"]);
  });
});
