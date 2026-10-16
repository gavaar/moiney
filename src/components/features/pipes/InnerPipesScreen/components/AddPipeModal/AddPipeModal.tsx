import type { Id } from "@convex/_generated/dataModel";
import { PipeForm } from "@features/pipes/PipeForm/PipeForm";
import { PipeFormModal } from "@features/pipes/PipeForm/PipeFormModal";

type Props = { parentId?: Id<"pipes">; visible: boolean; onClose: () => void };

export function AddPipeModal({ parentId, visible, onClose }: Props) {
  return visible ? <PipeFormModal key={parentId ?? "no-owner"} mode="create" parentId={parentId} onClose={onClose} /> : null;
}

export function AddPipeForm({ parentId, onClose, onDismissStateChange }: Omit<Props, "visible"> & {
  onDismissStateChange?: (dirty: boolean, busy: boolean) => void;
}) {
  return <PipeForm mode="create" parentId={parentId} onClose={onClose} onDismissStateChange={onDismissStateChange} />;
}
