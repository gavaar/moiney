// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/pipes/context/PipeSelectionContext", () => ({
  usePipeSelection: () => ({
    selectedPipe: { _id: "pipe_root", name: "Root Pipe", icon: "home-outline", priority: 0, capacity: 0, fed: 0, spent: 0 },
    childrenByParent: new Map([
      ["pipe_root", [
        { _id: "pipe_child_1", name: "Child 1", icon: "cafe", parentId: "pipe_root", priority: 0, capacity: 0, fed: 0, spent: 0 },
        { _id: "pipe_child_2", name: "Child 2", icon: "car-sport-outline", parentId: "pipe_root", priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
      ["pipe_child_1", [
        { _id: "pipe_gc_1", name: "Grandchild 1", icon: "game-controller-outline", parentId: "pipe_child_1", priority: 0, capacity: 0, fed: 0, spent: 0 },
      ]],
    ]),
    pipesById: {
      pipe_root: { _id: "pipe_root", name: "Root Pipe", icon: "home-outline", parentId: undefined, priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_1: { _id: "pipe_child_1", name: "Child 1", icon: "cafe", parentId: "pipe_root", priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_child_2: { _id: "pipe_child_2", name: "Child 2", icon: "car-sport-outline", parentId: "pipe_root", priority: 0, capacity: 0, fed: 0, spent: 0 },
      pipe_gc_1: { _id: "pipe_gc_1", name: "Grandchild 1", icon: "game-controller-outline", parentId: "pipe_child_1", priority: 0, capacity: 0, fed: 0, spent: 0 },
    },
    isLoading: false,
  }),
}));

import { DeletePipeConfirmation } from "./DeletePipeConfirmation";

describe("DeletePipeConfirmation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders pipe name and descendant list", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={() => {}} />,
    );
    const rootPipeElements = screen.getAllByText("Root Pipe");
    expect(rootPipeElements.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Child 1")).toBeTruthy();
    expect(screen.getByText("Child 2")).toBeTruthy();
    expect(screen.getByText("Grandchild 1")).toBeTruthy();
  });

  it("renders warning box", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={() => {}} />,
    );
    expect(screen.getByText(/delete this pipe/)).toBeTruthy();
  });

  it("renders transactions checkbox", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={() => {}} />,
    );
    expect(screen.getByText("Also delete pipe's transactions")).toBeTruthy();
  });

  it("disables confirm button for 2 seconds then enables", () => {
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={() => {}} />,
    );
    const button = screen.getByText("Confirm deletion");
    expect(button).toBeTruthy();
    act(() => { vi.advanceTimersByTime(2000); });
  });

  it("calls onConfirm with all descendant pipe IDs and deleteTransactions state", () => {
    const onConfirm = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={onConfirm} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByText("Confirm deletion"));
    expect(onConfirm).toHaveBeenCalledWith({
      pipeIds: ["pipe_root", "pipe_child_1", "pipe_gc_1", "pipe_child_2"],
      deleteTransactions: false,
    });
  });

  it("toggles checkbox for transaction deletion", () => {
    const onConfirm = vi.fn();
    render(
      <DeletePipeConfirmation visible={true} onClose={() => {}} pipeId="pipe_root" onConfirm={onConfirm} />,
    );
    act(() => { vi.advanceTimersByTime(2000); });
    fireEvent.click(screen.getByText("Also delete pipe's transactions"));
    fireEvent.click(screen.getByText("Confirm deletion"));
    expect(onConfirm).toHaveBeenCalledWith({
      pipeIds: ["pipe_root", "pipe_child_1", "pipe_gc_1", "pipe_child_2"],
      deleteTransactions: true,
    });
  });
});
