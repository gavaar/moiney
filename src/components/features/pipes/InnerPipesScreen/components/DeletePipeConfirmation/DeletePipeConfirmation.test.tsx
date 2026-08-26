// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";

const pId = (id: string) => id as Id<"pipes">;

const mockStartPipeDeletion = vi.fn();
const mockDeletionStatus = vi.fn();
const mockConvexQuery = vi.fn();
const mockReconcileTransactions = vi.fn().mockResolvedValue(undefined);

vi.mock("convex/react", () => ({
  useMutation: () => mockStartPipeDeletion,
  useQuery: () => mockDeletionStatus(),
  useConvex: () => ({ query: mockConvexQuery }),
}));

vi.mock("@features/transactions/cache/TransactionCacheContext", () => ({
  useOptionalTransactionCache: () => ({
    cache: { entities: { "tx-1": {} } },
    reconcileTransactions: mockReconcileTransactions,
    invalidateAll: vi.fn(),
  }),
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({
    pipesById: {
      pipe_root: { id: pId("pipe_root"), name: "Root Pipe", icon: "home-outline", parentId: undefined, priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_1: { id: pId("pipe_child_1"), name: "Child 1", icon: "cafe", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_2: { id: pId("pipe_child_2"), name: "Child 2", icon: "car-sport-outline", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_gc_1: { id: pId("pipe_gc_1"), name: "Grandchild 1", icon: "game-controller-outline", parentId: pId("pipe_child_1"), priority: 0, capacity: 0, fed: 0, spent: 0 },
    },
    childrenByParent: new Map([
      [pId("pipe_root"), [
        { id: pId("pipe_child_1"), name: "Child 1", icon: "cafe", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
        { id: pId("pipe_child_2"), name: "Child 2", icon: "car-sport-outline", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
      [pId("pipe_child_1"), [
        { id: pId("pipe_gc_1"), name: "Grandchild 1", icon: "game-controller-outline", parentId: pId("pipe_child_1"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
    ]),
  }),
}));

import { DeletePipeConfirmation } from "./DeletePipeConfirmation";

describe("DeletePipeConfirmation", () => {
  beforeEach(() => {
    mockStartPipeDeletion.mockResolvedValue({ jobId: pId("job-1"), phase: "processingTransactions" });
    mockDeletionStatus.mockReturnValue(undefined);
    mockConvexQuery.mockResolvedValue([]);
    mockReconcileTransactions.mockReset();
    mockReconcileTransactions.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders pipe name and descendant list", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );
    const rootPipeElements = screen.getAllByText("Root Pipe");
    expect(rootPipeElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Child 1")).toBeTruthy();
    expect(screen.getByText("Child 2")).toBeTruthy();
    expect(screen.getByText("Grandchild 1")).toBeTruthy();
  });

  it("renders warning box", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );
    expect(screen.getByText(/delete this pipe/)).toBeTruthy();
  });

  it("renders transactions checkbox", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );
    expect(screen.getByText("Delete orphaned transaction history")).toBeTruthy();
  });

  it("enables deletion immediately", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );
    const button = screen.getByText("Delete 4 pipes");
    expect(button).toBeTruthy();
  });

  it("starts a deletion job on confirm", async () => {
    const onDeleted = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });
    expect(mockStartPipeDeletion).toHaveBeenCalledWith({ pipeId: pId("pipe_root"), deleteTransactions: false });
  });

  it("starts a purge job when checkbox is checked", async () => {
    const onDeleted = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    fireEvent.click(screen.getByText("Delete orphaned transaction history"));
    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });
    expect(mockStartPipeDeletion).toHaveBeenCalledWith({ pipeId: pId("pipe_root"), deleteTransactions: true });
  });

  it("allows the modal to be dismissed while the job continues", async () => {
    const onClose = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={onClose} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });
    fireEvent.click(screen.getByTestId("modal-backdrop"));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows deletion progress while the worker is running", async () => {
    mockDeletionStatus.mockReturnValue({
      jobId: pId("job-1"),
      phase: "processingTransactions",
      deleteTransactions: true,
      totalMembers: 4,
      completedMembers: 1,
    });
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });

    expect(screen.getByText("Deleting 1 of 4 pipes...")).toBeTruthy();
  });

  it("shows all pipes processed while finalization is ready", async () => {
    mockDeletionStatus.mockReturnValue({
      jobId: pId("job-1"),
      phase: "readyToFinalize",
      deleteTransactions: false,
      totalMembers: 4,
      completedMembers: 0,
    });
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });

    expect(screen.getByText("Deleting 4 of 4 pipes...")).toBeTruthy();
  });

  it("closes after the deletion status reaches complete", async () => {
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    mockDeletionStatus.mockReturnValue({
      jobId: pId("job-1"),
      phase: "complete",
      deleteTransactions: false,
      totalMembers: 4,
      completedMembers: 4,
    });
    render(
      <DeletePipeConfirmation visible={true} onClose={onClose} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });
    expect(onDeleted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("reconciles cached transactions after deletion completes", async () => {
    const surviving = {
      id: "tx-1",
      createdAt: 1,
      title: "surviving transaction",
      value: -100,
      date: 1,
      kind: "expense",
      from: pId("pipe_child_1"),
      fromIcon: "cafe",
    };
    mockDeletionStatus.mockReturnValue({
      jobId: pId("job-1"),
      phase: "complete",
      deleteTransactions: true,
      totalMembers: 4,
      completedMembers: 4,
    });
    mockConvexQuery.mockResolvedValue([surviving]);
    render(
      <DeletePipeConfirmation
        visible={true}
        onClose={() => {}}
        pipeId={pId("pipe_root")}
        onDeleted={() => {}}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Delete 4 pipes"));
    });

    await act(async () => {
      await Promise.resolve();
    });
    expect(mockConvexQuery).toHaveBeenCalledWith(expect.anything(), {
      transactionIds: ["tx-1"],
    });
    expect(mockReconcileTransactions).toHaveBeenCalledWith(["tx-1"], [surviving]);
  });
});
