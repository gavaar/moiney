// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { Id } from "@convex/_generated/dataModel";
import { PipeCatalogProvider } from "@features/pipes/context/PipeCatalogContext";
import { PipeSelectionProvider, usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { Breadcrumb } from "./Breadcrumb";

vi.mock("convex/react", () => ({
  useQuery: () => [{ _id: "root", name: "Budget", icon: "unknown-server-icon", priority: 0, capacity: 0, fed: 0, spent: 0 }],
}));

function SelectRoot() {
  const { selectPipe } = usePipeSelection();
  return <button onClick={() => selectPipe(["root" as Id<"pipes">])}>Select budget</button>;
}

it("normalizes an unknown pipe icon before rendering the breadcrumb", async () => {
  render(<PipeCatalogProvider>
    <PipeSelectionProvider>
      <SelectRoot />
      <Breadcrumb />
    </PipeSelectionProvider>
  </PipeCatalogProvider>);

  await userEvent.click(screen.getByRole("button", { name: "Select budget" }));
  const home = screen.getByRole("button", { name: "Go to pipe root" });
  expect(within(home).getByTestId("mock-icon").getAttribute("name")).toBe("pipe");
});
