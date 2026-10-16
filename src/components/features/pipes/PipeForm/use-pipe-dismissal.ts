import { useCallback, useRef } from "react";
import { useConfirmWithModal } from "@ui/ConfirmModal/ConfirmModalProvider";

export function usePipeDismissal(onClose: () => void) {
  const confirm = useConfirmWithModal();
  const state = useRef({ dirty: false, busy: false });
  const onDismissStateChange = useCallback((dirty: boolean, busy: boolean) => {
    state.current = { dirty, busy };
  }, []);
  const requestClose = async () => {
    if (state.current.busy) return;
    if (!state.current.dirty || await confirm({
      title: "Discard changes?",
      message: "Your unsaved pipe changes will be lost.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      destructive: true
    })) onClose();
  };
  return { onDismissStateChange, requestClose };
}
