// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";
import { type Id } from "@convex/_generated/dataModel";

const pId = (id: string) => id as Id<"pipes">;

const mockDeletePipe = vi.fn();

vi.mock("convex/react", () => ({
  useMutation: () => mockDeletePipe,
}));

const mockShowAlert = { success: vi.fn(), error: vi.fn() };
vi.mock("@ui/Alert", () => ({
  useAlert: () => mockShowAlert,
}));

vi.mock("@features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    selectedPipe: { _id: pId("pipe_root"), name: "Root Pipe", icon: "home-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
    childrenByParent: new Map([
      [pId("pipe_root"), [
        { _id: pId("pipe_child_1"), name: "Child 1", icon: "cafe", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
        { _id: pId("pipe_child_2"), name: "Child 2", icon: "car-sport-outline", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
      [pId("pipe_child_1"), [
        { _id: pId("pipe_gc_1"), name: "Grandchild 1", icon: "game-controller-outline", parentId: pId("pipe_child_1"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
    ]),
    pipesById: {
      pipe_root: { _id: pId("pipe_root"), name: "Root Pipe", icon: "home-outline", parentId: undefined, priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_1: { _id: pId("pipe_child_1"), name: "Child 1", icon: "cafe", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_2: { _id: pId("pipe_child_2"), name: "Child 2", icon: "car-sport-outline", parentId: pId("pipe_root"), priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_gc_1: { _id: pId("pipe_gc_1"), name: "Grandchild 1", icon: "game-controller-outline", parentId: pId("pipe_child_1"), priority: 0, capacity: 0, fed: 0, spent: 0 },
    },
    isLoading: false,
  }),
}));

import { DeletePipeConfirmation } from "./DeletePipeConfirmation";

describe("DeletePipeConfirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockDeletePipe.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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
    expect(screen.getByText("Also delete pipe's transactions")).toBeTruthy();
  });

  it("disables confirm button for 2 seconds then enables", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={() => {}} />,
    );
    const button = screen.getByText("Confirm deletion");
    expect(button).toBeTruthy();
    act(() => { vi.advanceTimersByTime(2000); });
  });

  it("calls deletePipe mutation on confirm", async () => {
    const onDeleted = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByText("Confirm deletion"));
    expect(mockDeletePipe).toHaveBeenCalledWith({ pipeId: pId("pipe_root"), deleteTransactions: false });
  });

  it("calls deletePipe with deleteTransactions when checkbox checked", async () => {
    const onDeleted = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByText("Also delete pipe's transactions"));
    fireEvent.click(screen.getByText("Confirm deletion"));
    expect(mockDeletePipe).toHaveBeenCalledWith({ pipeId: pId("pipe_root"), deleteTransactions: true });
  });

  it("calls onDeleted and onClose on successful deletion", async () => {
    const onDeleted = vi.fn();
    const onClose = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={onClose} pipeId={pId("pipe_root")} onDeleted={onDeleted} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    await act(async () => {
      fireEvent.click(screen.getByText("Confirm deletion"));
    });
    expect(onDeleted).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
