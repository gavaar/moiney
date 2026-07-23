// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

vi.mock("@/features/pipes/components/PipesList", () => ({
  PipesList: ({ pipes, onSelectPipe, leading }: any) => (
    <div data-testid="pipes-list" data-count={pipes.length}>
      {pipes.map((pipe: any) => (
        <div key={pipe._id} data-testid="pipe-row">
          {leading?.(pipe)}
          <button
            data-testid="select-child"
            onClick={() => onSelectPipe?.(pipe._id)}
          >
            {pipe.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

vi.mock("@/features/components/SpentForm", () => ({
  SpentForm: () => <div data-testid="spent-form" />,
}));

const mockUsePipeSelection = vi.fn();

vi.mock("@/features/pipes/context/PipeSelectionContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/pipes/context/PipeSelectionContext")>();
  return {
    ...actual,
    usePipeSelection: () => mockUsePipeSelection(),
  };
});

const baseMock = {
  selectedPipePath: [],
  allPipes: [],
  pipesById: {},
  childrenByParent: new Map(),
  selectPipe: vi.fn(),
  deselectPipe: vi.fn(),
  selectedName: null,
  selectedPipe: null,
};

const childPipe1 = { _id: "child-1", name: "Rent", icon: "home-outline", capacity: 1000, fed: 800, spent: 600 };
const childPipe2 = { _id: "child-2", name: "Food", icon: "restaurant-outline", capacity: 500, fed: 400, spent: 300 };

describe("InnerPipesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it("renders statistics row", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByText(/L2S: 0\.00/)).toBeDefined();
  });

  it("renders children of selected pipe in PipesList", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1, childPipe2]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: { _id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 2000, fed: 1500, spent: 1200 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    const pipesList = screen.getByTestId("pipes-list");
    expect(pipesList.getAttribute("data-count")).toBe("2");
  });

  it("renders lock-open-outline icon for each child via leading", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: { _id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 2000, fed: 1500, spent: 1200 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    const icons = screen.getAllByTestId("icon");
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls selectPipe with extended path when a child is tapped", async () => {
    const user = userEvent.setup();
    const selectPipe = vi.fn();
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectPipe,
      childrenByParent,
      selectedPipe: { _id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 2000, fed: 1500, spent: 1200 },
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);
    await user.click(screen.getByTestId("select-child"));
    expect(selectPipe).toHaveBeenCalledWith(["pipe-1", "child-1"]);
  });

  it("does not render selected name text", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);
    expect(screen.queryByText(/selected Groceries/i)).toBeNull();
  });

  it("renders SpentForm when pipe has no children", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: { _id: "pipe-1", name: "Groceries", icon: "pipe" },
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);
    expect(screen.getByTestId("spent-form")).toBeDefined();
  });

  it("does not render SpentForm when pipe has children", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: { _id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 2000, fed: 1500, spent: 1200 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    expect(screen.queryByTestId("spent-form")).toBeNull();
  });
});
