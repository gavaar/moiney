import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import {
  TransactionList,
  type TransactionListProps,
} from "@ui/TransactionList";
import { TransactionCorrectionHistoryModal } from "./components/TransactionCorrectionHistory/TransactionCorrectionHistoryModal";

export function TransactionListWithHistory(props: TransactionListProps) {
  const [selectedTransactionId, setSelectedTransactionId] = useState<Id<"transactions"> | null>(null);

  const selectedTransaction = props.transactions?.find(
    (transaction) => transaction._id === selectedTransactionId,
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
