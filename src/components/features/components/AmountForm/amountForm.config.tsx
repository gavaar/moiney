import { Text } from "react-native";
import { formatAmount } from "@/lib/format";
import type { FormProps } from "@ui/Form";
import type { AmountFormDraft, SourcePicker } from "./types";
import type { PipeModel } from "@features/pipes/data/pipes";
import { renderTransactionPipe, transactionPipeItems, transactionPipeStyle } from "./pipeOptions";

type PipeOption = { id: string; name: string; icon: string };
type AmountFormConfiguration = {
  isFeed: boolean;
  pipesById: Readonly<Record<string, PipeModel>>;
  common: { loading: boolean; recentTitles: readonly string[] };
  spend: {
    mode: "spend" | "transfer";
    isNegative: boolean;
    pipeItems: readonly PipeOption[];
    paidFromPipeItems: readonly PipeOption[];
    showPaidFrom: boolean;
    setShowPaidFrom: (show: boolean) => void;
  } | null;
  transaction: { paidFrom: { label: string; items: readonly PipeOption[] } | null } | null;
  boiler: { name: string; contributionAmount: number; currentFedChanged: boolean } | null;
};

export function buildAmountForm(form: AmountFormConfiguration, sourcePicker?: SourcePicker) {
  const { common, spend, boiler, transaction, pipesById } = form;
  const fields: FormProps<AmountFormDraft>["form"][number][] = [];
  if (sourcePicker) fields.push({
    key: "sourcePipeId", step: 0,
    input: {
      type: "select", presentation: "inline", label: "Transaction pipe", hideLabel: true,
      items: transactionPipeItems(sourcePicker.pipes, pipesById, true),
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
      loading: sourcePicker.loading, disabled: common.loading,
    },
  });
  const step = sourcePicker ? 1 : 0;
  fields.push(
    { key: "title", step, input: { type: "text-select", options: common.recentTitles, maxLength: 140, multiline: true, placeholder: "What was this for?", disabled: common.loading } },
    { key: "value", step, row: "amount-date", input: { type: "decimal", label: form.isFeed ? "Amount" : "Value", placeholder: "0.00", allowNegative: !form.isFeed, disabled: common.loading } },
    { key: "date", step, row: "amount-date", input: { type: "date", label: "Date", disabled: common.loading } },
  );
  const paidFrom = transaction?.paidFrom;
  if (paidFrom || spend?.mode === "spend") fields.push({
    key: "paidFrom", step,
    input: {
      type: "select", label: paidFrom?.label ?? (spend?.isNegative ? "Paid from" : "Refunded to"),
      items: transactionPipeItems(paidFrom?.items ?? spend?.paidFromPipeItems ?? [], pipesById),
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
       placeholder: "None", disabled: common.loading,
    },
    ...(!paidFrom && spend ? { reveal: {
      label: "Paid from another pipe?", icon: "wallet-outline" as const,
      expanded: spend.showPaidFrom, onReveal: () => spend.setShowPaidFrom(true),
    } } : {}),
  });
  if (spend?.mode === "transfer") fields.push({
    key: "sentTo", step, input: {
      type: "select", label: "Transfer to", placeholder: "None", disabled: common.loading,
      items: transactionPipeItems(spend.pipeItems, pipesById),
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
    },
  });
  if (boiler) fields.push({
    key: "currentFed", step,
    input: { type: "decimal", label: `Current in ${boiler.name}`, allowNegative: false, disabled: common.loading },
    description: boiler.contributionAmount > 0 && !boiler.currentFedChanged ? (
      <Text testID="boiler-growth-hint" className="text-xs text-muted">
        <Text testID="boiler-growth-amount" className="font-bold">+{formatAmount(boiler.contributionAmount)}:</Text>{" "}
        current will also grow by {formatAmount(boiler.contributionAmount)} after this operation, unless manually modified
      </Text>
    ) : undefined,
  });
  return fields;
}
