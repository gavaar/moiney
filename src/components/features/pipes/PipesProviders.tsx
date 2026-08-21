import type { ReactNode } from "react";
import { PipeCatalogProvider } from "./context/PipeCatalogContext";
import { PipeSelectionProvider } from "./context/PipeSelectionContext";
import { TransactionsProvider } from "@features/transactions/context/TransactionsContext";

export function PipesProviders({ children }: { children: ReactNode }) {
  return (
    <PipeCatalogProvider>
      <PipeSelectionProvider>
        <TransactionsProvider>
          {children}
        </TransactionsProvider>
      </PipeSelectionProvider>
    </PipeCatalogProvider>
  );
}
