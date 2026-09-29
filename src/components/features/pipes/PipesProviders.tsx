import type { ReactNode } from "react";
import { PipeSelectionProvider } from "./context/PipeSelectionContext";

export function PipesProviders({ children }: { children: ReactNode }) {
  return (
    <PipeSelectionProvider>
      {children}
    </PipeSelectionProvider>
  );
}
