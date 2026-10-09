// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import type { PipeModel } from "@features/pipes/data/pipes";
import { PipeSelectionProvider, usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { OptionsButton } from "./OptionsButton";

const state = vi.hoisted(() => ({ complete: false }));
const startDeletion = vi.fn().mockResolvedValue({ jobId: "job-1" });
const query = vi.fn().mockResolvedValue([]);
const invalidateHistory = vi.fn().mockResolvedValue(undefined);
const alert = { success: vi.fn(), error: vi.fn() };
vi.mock("convex/react", () => ({
  useMutation: () => startDeletion,
  useConvex: () => ({ query }),
  useQuery: (_name: unknown, args: unknown) => args !== "skip" && state.complete
    ? { phase: "complete", deleteTransactions: false } : undefined,
}));
vi.mock("@ui/Alert", () => ({ useAlert: () => alert }));
vi.mock("@features/transactions/cache/EventHistoryCacheContext", () => ({
  useOptionalEventHistoryCache: () => ({
    invalidateHistory,
  }),
}));
vi.mock("@ui/Popover", () => ({ Popover: ({ visible, children }: React.PropsWithChildren<{ visible: boolean }>) => visible ? children : null }));
vi.mock("@features/pipes/InnerPipesScreen/components/AddPipeModal", () => ({ AddPipeModal: () => null }));
vi.mock("@features/pipes/InnerPipesScreen/components/EditPipeModal", () => ({ EditPipeModal: () => null }));

function pipe(id: string, parentId?: PipeModel["id"]): PipeModel {
  return { id: id as PipeModel["id"], parentId, name: id, icon: "wallet-outline", priority: 0, capacity: 0, fed: 0, spent: 0 };
}
const root = pipe("root");
const parent = pipe("parent", root.id);
const child = pipe("child", parent.id);
let allPipes = [root, parent, child];
vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes, pipesById: Object.fromEntries(allPipes.map(p => [p.id, p])), childrenByParent: new Map() }),
}));

function Screen() {
  const { selectedName, selectedPipePath, selectPipe } = usePipeSelection();
  return <>
    <button onClick={() => selectPipe([root.id, parent.id, child.id])}>Select child</button>
    <span data-testid="path">{selectedPipePath.join(",")}</span>
    {selectedName && <OptionsButton pipeId={selectedPipePath[selectedPipePath.length - 1]} />}
  </>;
}

it("stays at the surviving parent when catalog removal and deletion completion arrive together", async () => {
  const { rerender } = render(<PipeSelectionProvider><Screen /></PipeSelectionProvider>);
  fireEvent.click(screen.getByText("Select child"));
  fireEvent.click(screen.getByRole("button", { name: "Pipe options" }));
  fireEvent.click(screen.getByText("Delete"));
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Delete 1 pipes" })));
  allPipes = [root, parent];
  state.complete = true;
  await act(async () => rerender(<PipeSelectionProvider><Screen /></PipeSelectionProvider>));
  expect(screen.getByTestId("path").textContent).toBe("root,parent");
  expect(alert.success).toHaveBeenCalledTimes(1);
  expect(invalidateHistory).toHaveBeenCalledOnce();
});
