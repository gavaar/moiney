import { ModalShell } from "@ui/Modal";
import { PipeForm, type PipeFormProps } from "./PipeForm";
import { useFormDismissal } from "@ui/Form/use-form-dismissal";

/** A mounted session owns its draft and guards dismissal; success closes directly. */
export function PipeFormModal(props: PipeFormProps) {
  const dismissal = useFormDismissal(props.onClose);
  return <ModalShell visible onClose={() => void dismissal.requestClose()}>
    <PipeForm {...props} onDismissStateChange={dismissal.onDismissStateChange} />
  </ModalShell>;
}
