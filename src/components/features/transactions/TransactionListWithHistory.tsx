import { useState } from "react";
import {
  TransactionList,
  type TransactionListProps,
} from "@ui/TransactionList";
import { usePipeCatalog } from "@features/pipes/context/PipeCatalogContext";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { TransactionCorrectionHistoryModal } from "./components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";

export function TransactionListWithHistory(props: TransactionListProps) {
  const { allPipes } = usePipeCatalog();
  const [selectedTransactionId, setSelectedTransactionId] = useState<TransactionModel["id"] | null>(null);
  const visiblePipeIds = props.visiblePipeIds ?? allPipes?.map((pipe) => pipe.id);

  const selectedTransaction = props.transactions?.find(
    (transaction) => transaction.id === selectedTransactionId,
  );

  return (
    <>
      <TransactionList
        {...props}
        visiblePipeIds={visiblePipeIds}
        onShowEditHistory={setSelectedTransactionId}
      />
      {selectedTransactionId ? (
        <TransactionCorrectionHistoryModal
          visible
          transactionId={selectedTransactionId}
          transactionTitle={selectedTransaction?.title ?? "Transaction"}
          onClose={() => setSelectedTransactionId(null)}
        />
      ) : null}
    </>
  );
}
