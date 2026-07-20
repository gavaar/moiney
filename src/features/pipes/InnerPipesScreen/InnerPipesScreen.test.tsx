// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { InnerPipesScreen } from "./InnerPipesScreen";

const mockAddPipe = vi.fn();

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

const mockUsePipeSelection = vi.fn();

vi.mock("@/features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => mockUsePipeSelection(),
}));

const baseMock = {
  selectedPipePath: [],
  allPipes: [],
  pipesById: {},
  childrenByParent: new Map(),
  selectPipe: vi.fn(),
  selectedName: null,
  selectedPipe: null,
};

describe("InnerPipesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the selected pipe name", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByText(/selected Groceries/i)).toBeDefined();
  });

  it("renders breadcrumb", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      allPipes: [{ _id: "pipe-1", name: "Groceries" }],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByTestId("breadcrumb-home")).toBeDefined();
  });

  it("renders pipe bars", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: {
        _id: "pipe-1",
        name: "Groceries",
        icon: "pipe",
        capacity: 2000,
        fed: 1500,
        spent: 1200,
      },
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });

  it("renders statistics placeholder", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByText("statistics")).toBeDefined();
  });
});
