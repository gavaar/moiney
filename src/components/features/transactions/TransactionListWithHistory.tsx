import { useState } from "react";
import {
  TransactionList,
  type TransactionListProps,
} from "@ui/TransactionList";
import type { TransactionModel } from "@features/transactions/data/transactions";
import { TransactionCorrectionHistoryModal } from "./components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";

export function TransactionListWithHistory(props: TransactionListProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<TransactionModel["id"] | null>(null);

  const selectedTransaction = props.transactions?.find(
    (transaction) => transaction.id === selectedTransactionId,
  );

  return (
    <>
      <TransactionList
        {...props}
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
