import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { usePathname, useRouter, useSegments } from "expo-router";
import { usePipeSelectionState } from "@features/pipes/PipeSelectionStateProvider/PipeSelectionStateProvider";

type PipesNavigation = {
  openPipes: () => void;
  registerReturnToIndex: (callback: () => void) => () => void;
};

const PipesNavigationContext = createContext<PipesNavigation | null>(null);

function usePipesNavigationContext() {
  const value = useContext(PipesNavigationContext);
  if (!value) throw new Error("Pipes navigation requires PipesNavigationProvider");
  return value;
}

export function PipesNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { deselectPipe } = usePipeSelectionState();
  const segments: readonly string[] = useSegments();
  const switchingTabs = segments[1] === "(tabs)" && segments[2] !== "pipes";
  const returnToIndex = useRef<(() => void) | null>(null);
  const registerReturnToIndex = useCallback((callback: () => void) => {
    returnToIndex.current = callback;
    return () => { if (returnToIndex.current === callback) returnToIndex.current = null; };
  }, []);
  const openPipes = useCallback(() => {
    // Report details (including /pipes/current) switch back without reselecting.
    if (pathname === "/pipes") deselectPipe();
    else if (switchingTabs) {
      // POP_TO is a stack action, not a tab action. Return an inactive Pipes
      // stack to its existing index before switching tabs with NAVIGATE.
      returnToIndex.current?.();
      router.navigate("/pipes");
    }
    // NAVIGATE would append a new stack entry from Settings or a Pipes report.
    // dismissTo reuses the existing tree, or replaces on a cold entry.
    else router.dismissTo("/pipes");
  }, [deselectPipe, pathname, router, switchingTabs]);
  const value = useMemo(() => ({ openPipes, registerReturnToIndex }), [openPipes, registerReturnToIndex]);
  return <PipesNavigationContext value={value}>{children}</PipesNavigationContext>;
}

export function useOpenPipes() {
  return usePipesNavigationContext().openPipes;
}

// Only the mounted Pipes screen has a navigation handle for its own stack.
export function usePipesStackReturn(returnToIndex: () => void) {
  const { registerReturnToIndex } = usePipesNavigationContext();
  useEffect(() => registerReturnToIndex(returnToIndex), [returnToIndex, registerReturnToIndex]);
}
