import { createContext, useContext, useMemo, type ReactNode } from "react";
import { usePipeNavigation } from "../navigation/pipe-navigation";

type PipeSelectionState = ReturnType<typeof usePipeNavigation>;

const PipeSelectionStateContext = createContext<PipeSelectionState | null>(null);

export function usePipeSelectionState() {
  const value = useContext(PipeSelectionStateContext);
  if (!value) throw new Error("usePipeSelectionState must be used within PipeSelectionStateProvider");
  return value;
}

export function PipeSelectionStateProvider({ children }: { children: ReactNode }) {
  const { selectedPipePath, selectPipe, deselectPipe, reconcilePipe } = usePipeNavigation();
  const value = useMemo(
    () => ({ selectedPipePath, selectPipe, deselectPipe, reconcilePipe }),
    [selectedPipePath, selectPipe, deselectPipe, reconcilePipe],
  );
  return <PipeSelectionStateContext value={value}>{children}</PipeSelectionStateContext>;
}
