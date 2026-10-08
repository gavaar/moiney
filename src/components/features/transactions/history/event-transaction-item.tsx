import { useCallback, useMemo } from "react";
import { useConvex } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TransactionItem } from "../components/TransactionItem";
import type { TransactionPresentation } from "../data/transactions";
import type { DeletedPipeEntry } from "./event-archives";
import type { FinancialOperation } from "./event-groups";

export function eventTransactionPresentation(operation: FinancialOperation, deletedPipes: readonly DeletedPipeEntry[]): TransactionPresentation {
  const icons = new Map(deletedPipes.map(event => [event.pipeId, event.icon]));
  const common = { createdAt: operation.createdAt, date: operation.occurredAt, title: operation.title, value: operation.value, editedAt: operation.editedAt };
  if (operation.type === "feed") return { ...common, kind: "feed", to: operation.pipeId, toIcon: icons.get(operation.pipeId) };
  if (operation.type === "transfer") return { ...common, kind: "transfer", from: operation.pipeId, to: operation.targetPipeId, fromIcon: icons.get(operation.pipeId), toIcon: icons.get(operation.targetPipeId) };
  return { ...common, kind: "expense", from: operation.pipeId, fromIcon: icons.get(operation.pipeId),
    ...(operation.type === "third_party_transaction" ? { paidFrom: operation.targetPipeId, paidFromIcon: icons.get(operation.targetPipeId) } : {}) };
}

export function EventTransactionItem({ operation, deletedPipes, onShowEditHistory }: {
  operation: FinancialOperation; deletedPipes: readonly DeletedPipeEntry[];
  onShowEditHistory: (id: Id<"transactions">) => void;
}) {
  const client = useConvex();
  const transaction = useMemo(() => eventTransactionPresentation(operation, deletedPipes), [operation, deletedPipes]);
  const resolveTransaction = useCallback(() => client.query(api.transactions.forEventOperation, { operationId: operation.id }), [client, operation.id]);
  return <TransactionItem transaction={transaction} resolveTransaction={resolveTransaction} onShowEditHistory={onShowEditHistory} />;
}
