// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { PipeModel } from "../data/pipes";
import { PipeSelectionStateProvider, usePipeSelectionState } from "./PipeSelectionStateProvider";

const path = ["root", "child"] as PipeModel["id"][];

function SelectionControls() {
  const { selectedPipePath, selectPipe, deselectPipe } = usePipeSelectionState();
  return <>
    <button onClick={() => selectPipe(path)}>Select child</button>
    <button onClick={deselectPipe}>Clear selection</button>
    <output>{selectedPipePath.join(",") || "None"}</output>
  </>;
}

it("selects and clears a path without a catalog or backend provider", () => {
  render(<PipeSelectionStateProvider><SelectionControls /></PipeSelectionStateProvider>);
  expect(screen.getByRole("status").textContent).toBe("None");
  fireEvent.click(screen.getByRole("button", { name: "Select child" }));
  expect(screen.getByRole("status").textContent).toBe("root,child");
  fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
  expect(screen.getByRole("status").textContent).toBe("None");
});
