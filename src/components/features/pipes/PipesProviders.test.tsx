// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { usePipeCatalog } from "./context/PipeCatalogContext";
import { usePipeSelection } from "./context/PipeSelectionContext";
import { useTransactions } from "@features/transactions/context/TransactionsContext";
import { PipesProviders } from "./PipesProviders";

const mockUseQuery = vi.fn().mockReturnValue([]);

vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock("@convex/_generated/api", () => ({
  api: {
    pipes: { getPipes: {} },
    transactions: { listTransactions: {} },
  },
}));

function ProviderConsumer() {
  const { allPipes } = usePipeCatalog();
  const { selectedPipePath } = usePipeSelection();
  const { transactions } = useTransactions();
  return (
    <div>
      <span data-testid="pipes-count">{allPipes?.length ?? "undefined"}</span>
      <span data-testid="selection-count">{selectedPipePath.length}</span>
      <span data-testid="transactions-count">
        {transactions?.length ?? "undefined"}
      </span>
    </div>
  );
}

describe("PipesProviders", () => {
  it("composes catalog, selection, and latest transaction providers", () => {
    render(
      <PipesProviders>
        <ProviderConsumer />
      </PipesProviders>,
    );

    expect(screen.getByTestId("pipes-count").textContent).toBe("0");
    expect(screen.getByTestId("selection-count").textContent).toBe("0");
    expect(screen.getByTestId("transactions-count").textContent).toBe("0");
  });
});
