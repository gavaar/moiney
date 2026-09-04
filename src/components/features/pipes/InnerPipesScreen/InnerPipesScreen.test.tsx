// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InnerPipesScreen } from "./InnerPipesScreen";

vi.mock("react-native", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-native")>()),
  ScrollView: ({ children, keyboardShouldPersistTaps }: any) => (
    <div
      data-testid="amount-form-scroll"
      data-keyboard-should-persist-taps={keyboardShouldPersistTaps}
    >
      {children}
    </div>
  ),
}));

const mockAddPipe = vi.fn();
const mockConvexQuery = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockAddPipe,
  useQuery: () => undefined,
  useConvex: () => ({ query: mockConvexQuery }),
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: {
      addPipe: {},
    },
  },
}));

vi.mock("@features/pipes/components/PipesList", () => ({
  PipesList: ({ pipes, onSelectPipe, leading }: any) => (
    <div data-testid="pipes-list" data-count={pipes.length}>
      {pipes.map((pipe: any) => (
        <div key={pipe.id} data-testid="pipe-row">
          {leading?.(pipe)}
          <button
            data-testid="select-child"
            onClick={() => onSelectPipe?.(pipe.id)}
          >
            {pipe.name}
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@ui/Icon", () => ({
  Icon: ({ name, testID }: any) => <span data-testid={testID ?? "icon"} data-name={name} />,
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@features/components/AmountForm", () => ({
  AmountForm: () => <div data-testid="spent-form" />,
}));

const mockUsePipeSelection = vi.fn();

vi.mock("@features/pipes/context/PipeSelectionContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@features/pipes/context/PipeSelectionContext")>();
  return {
    ...actual,
    usePipeSelection: () => mockUsePipeSelection(),
  };
});
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => mockUsePipeSelection(),
}));

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

const childPipe1 = { id: "child-1", name: "Rent", icon: "home-outline", capacity: 100000, fed: 80000, spent: 60000 };
const childPipe2 = { id: "child-2", name: "Food", icon: "restaurant-outline", capacity: 50000, fed: 40000, spent: 30000 };
const grandchildPipe = { id: "grand-1", name: "Sub", icon: "pipe", capacity: 10000, fed: 0, spent: 0 };

describe("InnerPipesScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders breadcrumb", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
       allPipes: [{ id: "pipe-1", name: "Groceries" }],
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
        id: "pipe-1",
        name: "Groceries",
        icon: "pipe",
        capacity: 200000,
        fed: 150000,
        spent: 120000,
      },
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.getByTestId("bar-spent-fill")).toBeDefined();
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });

  it("uses boiler contributions for detail bars and growth", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["boiler-1"],
      selectedPipe: {
        id: "boiler-1",
        name: "Savings",
        icon: "water-boiler",
        capacity: 0,
        fed: 15000,
        spent: 0,
        sourceType: "boiler",
        contributedFed: 10000,
        rule: "instant_settlement",
      },
      selectedName: "Savings",
    });

    render(<InnerPipesScreen />);

    expect(screen.getByTestId("bar-contributed-fill")).toBeDefined();
    expect(screen.queryByTestId("bar-spent-fill")).toBeNull();
    const contributedRow = screen.getByText("contributed").parentElement!;
    expect(within(contributedRow).getByText("100.00")).toBeDefined();
    expect(screen.getByTestId("boiler-growth-chip").textContent).toContain(
      "+50%",
    );
  });

  it("uses a child's cap update for the selected parent's expected value", () => {
    const childrenByParent = new Map();
    childrenByParent.set("parent", [
      {
        id: "child",
        name: "Child",
        icon: "pipe",
        capacity: 36000,
        fed: 0,
        spent: 0,
        capUpdateValue: 12000,
        rule: "instant_settlement",
      },
    ]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["parent"],
      selectedPipe: {
        id: "parent",
        name: "Parent",
        icon: "pipe",
        capacity: 36000,
        fed: 0,
        spent: 0,
      },
      selectedName: "Parent",
      childrenByParent,
    });

    render(<InnerPipesScreen />);

    const expectedRow = screen.getByText("expected").parentElement!;
    expect(within(expectedRow).getByText("120.00")).toBeDefined();
  });

  it("hides the spent bar when the selected pipe rule is instant_settlement", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: {
        id: "pipe-1",
        name: "Groceries",
        icon: "pipe",
        capacity: 200000,
        fed: 150000,
        spent: 0,
        rule: "instant_settlement",
      },
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(screen.queryByTestId("bar-spent-fill")).toBeNull();
    expect(screen.getByTestId("bar-fed-fill")).toBeDefined();
    expect(screen.getByTestId("bar-capacity-fill")).toBeDefined();
  });

  it("renders statistics row", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedName: "Groceries",
    });
    render(<InnerPipesScreen />);
    expect(
      screen.getByRole("button", { name: "Left to spend, 0.00" }),
    ).toBeDefined();
  });

  it("renders children of selected pipe in PipesList", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1, childPipe2]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
        selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 200000, fed: 150000, spent: 120000 },
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
        selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 200000, fed: 150000, spent: 120000 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    const icons = screen.getAllByTestId("icon");
    expect(icons.length).toBeGreaterThanOrEqual(1);
  });

  it("renders a muted pipe icon for pipes with children and rule icon for leaf pipes", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1, childPipe2]);
    childrenByParent.set("child-1", [grandchildPipe]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
        selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 200000, fed: 150000, spent: 120000 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    const rows = screen.getAllByTestId("pipe-row");
    expect(within(rows[0]).getByTestId("rules-icon-placeholder")).toBeDefined();
    expect(within(rows[1]).getByTestId("icon").getAttribute("data-name")).toBe("lock-open-outline");
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
        selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 200000, fed: 150000, spent: 120000 },
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

  it("renders AmountForm when pipe has no children", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
       selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe" },
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);
    expect(screen.getByTestId("spent-form")).toBeDefined();
  });

  it("preserves handled keyboard taps around the leaf AmountForm", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
       selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe" },
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);

    expect(
      screen
        .getByTestId("amount-form-scroll")
        .getAttribute("data-keyboard-should-persist-taps"),
    ).toBe("handled");
  });

  it("keeps a frozen pipe visible without spend controls", () => {
    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
      selectedPipe: {
        id: "pipe-1",
        name: "Groceries",
        icon: "pipe",
        deletionJobId: "job-1",
      },
      selectedName: "Groceries",
    });

    render(<InnerPipesScreen />);

    expect(screen.queryByTestId("spent-form")).toBeNull();
    expect(screen.getByText("Pipe deletion in progress")).toBeDefined();
  });

  it("does not render AmountForm when pipe has children", () => {
    const childrenByParent = new Map();
    childrenByParent.set("pipe-1", [childPipe1]);

    mockUsePipeSelection.mockReturnValue({
      ...baseMock,
      selectedPipePath: ["pipe-1"],
        selectedPipe: { id: "pipe-1", name: "Groceries", icon: "pipe", capacity: 200000, fed: 150000, spent: 120000 },
      selectedName: "Groceries",
      childrenByParent,
    });

    render(<InnerPipesScreen />);
    expect(screen.queryByTestId("spent-form")).toBeNull();
  });
});
