import { useCallback, useRef } from "react";
import { useConfirmWithModal } from "@ui/ConfirmModal/ConfirmModalProvider";

export type OnDismissStateChange = (dirty: boolean, busy: boolean) => void;

export function useFormDismissal(onClose: () => void) {
  const confirm = useConfirmWithModal();
  const states = useRef(new Map<string, { dirty: boolean; busy: boolean }>());
  const onDismissStateChange = useCallback((dirty: boolean, busy: boolean, formId = "form") => {
    states.current.set(formId, { dirty, busy });
  }, []);
  const requestClose = async () => {
    const forms = [...states.current.values()];
    if (forms.some(form => form.busy)) return;
    if (!forms.some(form => form.dirty) || await confirm({
      title: "Discard changes?",
      message: "Your unsaved changes will be lost.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      destructive: true
    })) onClose();
  };
  return { onDismissStateChange, requestClose };
}
