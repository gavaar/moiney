import type { ReactNode } from "react";
import { PipeCatalogProvider } from "./context/PipeCatalogContext";
import { PipeSelectionProvider } from "./context/PipeSelectionContext";

export function PipesProviders({ children }: { children: ReactNode }) {
  return (
    <PipeCatalogProvider>
      <PipeSelectionProvider>
        {children}
      </PipeSelectionProvider>
    </PipeCatalogProvider>
  );
}
