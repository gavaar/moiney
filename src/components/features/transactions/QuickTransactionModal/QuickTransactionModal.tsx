import { ModalShell } from "@ui/Modal";
import { TransactionForm } from "@features/transactions/TransactionForm/TransactionForm";

type Props = { onClose: () => void };

export function QuickTransactionModal({ onClose }: Props) {
  return <ModalShell visible onClose={onClose}>
    <TransactionForm onSuccess={onClose} />
  </ModalShell>;
}
