import { useCallback, useMemo } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TransactionItem } from "@features/transactions/components/TransactionItem";
import type { TransactionPresentation } from "@features/transactions/data/transactions";
import type { FinancialOperation } from "@features/transactions/history/events/event-groups";

type DeletedPipeIcons = ReadonlyMap<Id<"pipes">, string>;

export function eventTransactionPresentation(operation: FinancialOperation, icons: DeletedPipeIcons): TransactionPresentation {
  const common = { createdAt: operation.createdAt, date: operation.occurredAt, title: operation.title, value: operation.value, editedAt: operation.editedAt };
  if (operation.type === "feed") return { ...common, kind: "feed", to: operation.pipeId, toIcon: icons.get(operation.pipeId) };
  if (operation.type === "transfer") return { ...common, kind: "transfer", from: operation.pipeId, to: operation.targetPipeId, fromIcon: icons.get(operation.pipeId), toIcon: icons.get(operation.targetPipeId) };
  return {
    ...common,
    kind: "expense",
    from: operation.pipeId,
    fromIcon: icons.get(operation.pipeId),
    ...(operation.type === "third_party_transaction" ? { paidFrom: operation.targetPipeId, paidFromIcon: icons.get(operation.targetPipeId) } : {})
  };
}

export function EventTransactionItem({ operation, deletedPipeIcons, onShowEditHistory }: {
  operation: FinancialOperation; deletedPipeIcons: DeletedPipeIcons;
  onShowEditHistory: (id: Id<"events">) => void;
}) {
  const client = useConvex();
  const transaction = useMemo(() => eventTransactionPresentation(operation, deletedPipeIcons), [operation, deletedPipeIcons]);
  const resolveTransaction = useCallback(async () => {
    const snapshot = await client.query(api.financialOperations.get, { operationId: operation.id });
    if (!snapshot) return null;
    const { operationId: id, ...facts } = snapshot;
    return { ...facts, id };
  }, [client, operation.id]);
  return <TransactionItem transaction={transaction} resolveTransaction={resolveTransaction} onShowEditHistory={() => onShowEditHistory(operation.id)} />;
}
