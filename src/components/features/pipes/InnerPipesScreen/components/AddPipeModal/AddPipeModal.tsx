import type { Id } from "@convex/_generated/dataModel";
import { PipeFormModal } from "@features/pipes/PipeForm/PipeFormModal";

type Props = { parentId?: Id<"pipes">; visible: boolean; onClose: () => void };

export function AddPipeModal({ parentId, visible, onClose }: Props) {
  return visible ? <PipeFormModal key={parentId ?? "no-owner"} mode="create" typePickerInitiallyExpanded parentId={parentId} onClose={onClose} /> : null;
}
