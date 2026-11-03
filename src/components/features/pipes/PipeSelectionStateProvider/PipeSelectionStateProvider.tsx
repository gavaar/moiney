import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { PipeModel } from "../data/pipes";

type PipeSelectionState = {
  selectedPipePath: PipeModel["id"][];
  selectPipe: Dispatch<SetStateAction<PipeModel["id"][]>>;
  deselectPipe: () => void;
};

const PipeSelectionStateContext = createContext<PipeSelectionState | null>(null);

export function usePipeSelectionState() {
  const value = useContext(PipeSelectionStateContext);
  if (!value) throw new Error("usePipeSelectionState must be used within PipeSelectionStateProvider");
  return value;
}

export function PipeSelectionStateProvider({ children }: { children: ReactNode }) {
  const [selectedPipePath, selectPipe] = useState<PipeModel["id"][]>([]);
  const deselectPipe = useCallback(() => selectPipe([]), []);
  const value = useMemo(() => ({ selectedPipePath, selectPipe, deselectPipe }), [selectedPipePath, selectPipe, deselectPipe]);
  return <PipeSelectionStateContext value={value}>{children}</PipeSelectionStateContext>;
}
