import type { Id } from "@convex/_generated/dataModel";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import { PipeFormModal } from "@features/pipes/PipeForm/PipeFormModal";

type Props = { visible: boolean; onClose: () => void; pipeId: Id<"pipes">; initialStep?: 1 | 3 };

export function EditPipeModal({ visible, onClose, pipeId, initialStep = 1 }: Props) {
  const { pipesById } = usePipeCatalog();
  const pipe = pipesById?.[pipeId];
  return visible && pipe ? <PipeFormModal key={pipeId} mode="edit" pipe={pipe} initialStep={initialStep} onClose={onClose} /> : null;
}
