// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { type Id } from "@convex/_generated/dataModel";
import { PipeSelectionProvider, usePipeSelection } from "./PipeSelectionContext";

const mockUseQuery = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock("@convex/_generated/api", () => ({
  api: { pipes: { getPipes: {} } },
}));

function TestConsumer() {
  const { selectedPipePath, selectPipe, deselectPipe, isLoading, feeds, selectedName } =
    usePipeSelection();
  return (
    <div>
      <span data-testid="path-length">{selectedPipePath.length}</span>
      <span data-testid="is-loading">{isLoading ? "true" : "false"}</span>
      <span data-testid="feeds-count">{feeds.length}</span>
      <span data-testid="selected-name">{selectedName ?? "(none)"}</span>
      <button data-testid="select" onClick={() => selectPipe(["pipe-1" as Id<"pipes">])}>
        Select
      </button>
      <button data-testid="deselect" onClick={deselectPipe}>
        Deselect
      </button>
    </div>
  );
}

const mockPipe = (id: string, name: string) => ({
  _id: id as Id<"pipes">,
  _creationTime: 0,
  userId: "user-1" as Id<"users">,
  name,
  icon: "icon",
  priority: 0,
  capacity: undefined,
  fed: undefined,
  spent: undefined,
  parentId: undefined,
  description: undefined,
  resetOn: undefined,
  resetCron: undefined,
});

describe("PipeSelectionContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state when allPipes is undefined", () => {
    mockUseQuery.mockReturnValue(undefined);
    render(
      <PipeSelectionProvider>
        <TestConsumer />
      </PipeSelectionProvider>,
    );
    expect(screen.getByTestId("is-loading").textContent).toBe("true");
    expect(screen.getByTestId("feeds-count").textContent).toBe("0");
    expect(screen.getByTestId("selected-name").textContent).toBe("(none)");
  });

  it("provides feeds and resolved name when data is available", () => {
    mockUseQuery.mockReturnValue([
      mockPipe("pipe-1", "Groceries"),
      mockPipe("pipe-2", "Salary"),
    ]);
    render(
      <PipeSelectionProvider>
        <TestConsumer />
      </PipeSelectionProvider>,
    );
    expect(screen.getByTestId("is-loading").textContent).toBe("false");
    expect(screen.getByTestId("feeds-count").textContent).toBe("2");
  });

  it("selects a pipe and resolves its name", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([mockPipe("pipe-1", "Groceries")]);
    render(
      <PipeSelectionProvider>
        <TestConsumer />
      </PipeSelectionProvider>,
    );

    expect(screen.getByTestId("path-length").textContent).toBe("0");
    await user.click(screen.getByTestId("select"));
    expect(screen.getByTestId("path-length").textContent).toBe("1");
    expect(screen.getByTestId("selected-name").textContent).toBe("Groceries");
  });

  it("deselects and clears the name", async () => {
    const user = userEvent.setup();
    mockUseQuery.mockReturnValue([mockPipe("pipe-1", "Groceries")]);
    render(
      <PipeSelectionProvider>
        <TestConsumer />
      </PipeSelectionProvider>,
    );

    await user.click(screen.getByTestId("select"));
    expect(screen.getByTestId("selected-name").textContent).toBe("Groceries");
    await user.click(screen.getByTestId("deselect"));
    expect(screen.getByTestId("path-length").textContent).toBe("0");
    expect(screen.getByTestId("selected-name").textContent).toBe("(none)");
  });
});
