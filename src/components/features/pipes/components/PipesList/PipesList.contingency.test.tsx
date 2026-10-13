// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { Id } from "@convex/_generated/dataModel";
import type { PipeModel } from "@features/pipes/data/pipes";
import { colors } from "@/lib/styles";
import { PipesList } from "./PipesList";

const pipes: PipeModel[] = [
  { id: "root" as Id<"pipes">, name: "Main", icon: "wallet", priority: 0, capacity: 0, fed: 0, spent: 0 },
  { id: "source" as Id<"pipes">, parentId: "root" as Id<"pipes">, contingencyPipeId: "donor" as Id<"pipes">,
    name: "Groceries", icon: "cart-outline", priority: 0, capacity: 4000, fed: 4000, spent: 7000 },
  { id: "donor" as Id<"pipes">, parentId: "root" as Id<"pipes">, name: "Reserve", icon: "cash-outline", priority: 1,
    capacity: 6000, fed: 6000, spent: 4000 },
];
let mockAllPipes: PipeModel[];

vi.mock("@features/pipes/context/PipeCatalogContext", () => ({
  usePipeCatalog: () => ({ allPipes: mockAllPipes, childrenByParent: new Map() }),
}));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ accountKey: "deployment:alice" }) }));

beforeEach(() => {
  localStorage.clear();
  mockAllPipes = pipes.map(pipe => ({ ...pipe }));
});

it("shows the selected donor inside a shield on full liquidity bars only", async () => {
  const { rerender } = render(<PipesList pipes={mockAllPipes.slice(1)} />);
  const source = await screen.findByRole("button", { name: "Groceries, contingency donor Reserve" });
  expect(within(source).getByTestId("coverage-shield").getAttribute("color")).toBe(colors.warning);
  const donorIcon = within(source).getByTestId("coverage-donor-icon");
  expect(donorIcon.getAttribute("name")).toBe("cash-outline");
  expect(donorIcon.getAttribute("color")).toBe(colors.text);
  expect(within(screen.getByRole("button", { name: "Reserve" })).queryByTestId("coverage-shield")).toBeNull();
  mockAllPipes[1].spent = 4000;
  rerender(<PipesList pipes={mockAllPipes.slice(1)} />);
  expect(within(source).getByTestId("coverage-shield").getAttribute("color")).toBe(colors.secondaryMuted);
});

it("does not add the coverage badge to minimized tiles", async () => {
  localStorage.setItem("moiney:pipe-views:deployment%3Aalice", '["source"]');
  render(<PipesList pipes={pipes.slice(1)} />);
  const tile = await screen.findByRole("button", { name: "Groceries" });
  expect(within(tile).getByTestId("liquidity")).toBeTruthy();
  expect(within(tile).queryByTestId("coverage-shield")).toBeNull();
});

it("shows the shared donor forecast next to actual spending and clears it when funding is exhausted", async () => {
  mockAllPipes[1].spent = 8000;
  mockAllPipes[2].fed = 10000;
  const { rerender } = render(<PipesList pipes={mockAllPipes.slice(1)} />);
  const donor = await screen.findByRole("button", { name: "Reserve" });
  expect(within(donor).getByTestId("spent-bar").style.width).toBe("40%");
  expect(within(donor).getByTestId("coverage-provided-bar").style.left).toBe("40%");
  expect(within(donor).getByTestId("coverage-provided-bar").style.width).toBe("40%");
  const source = screen.getByRole("button", { name: "Groceries, contingency donor Reserve" });
  expect(within(source).queryByTestId("coverage-provided-bar")).toBeNull();
  mockAllPipes[2].spent = 10000;
  rerender(<PipesList pipes={mockAllPipes.slice(1)} />);
  expect(within(donor).queryByTestId("coverage-provided-bar")).toBeNull();
});

it("does not show the donor forecast on minimized tiles", async () => {
  localStorage.setItem("moiney:pipe-views:deployment%3Aalice", '["donor"]');
  render(<PipesList pipes={mockAllPipes.slice(1)} />);
  const tile = await screen.findByRole("button", { name: "Reserve" });
  expect(within(tile).getByTestId("liquidity")).toBeTruthy();
  expect(within(tile).queryByTestId("coverage-provided-bar")).toBeNull();
});
