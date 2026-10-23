import { Text } from "react-native";
import { formatAmount } from "@/lib/format";
import { formBuilder } from "@ui/Form";
import type { AmountFormDraft, SourcePicker } from "./types";
import type { PipeModel } from "@features/pipes/data/pipes";
import type { InputProps } from "@ui/Input";
import { renderTransactionPipe, transactionPipeItems, transactionPipeStyle } from "./pipeOptions";

type PipeOption = { id: string; name: string; icon: string };
type PipeGroups = NonNullable<Extract<InputProps, { type: "select" }>["groups"]>;
type AmountFormConfiguration = {
  isFeed: boolean;
  pipesById: Readonly<Record<string, PipeModel>>;
  common: { loading: boolean; recentTitles: readonly string[] };
  spend: {
    mode: "spend" | "transfer";
    isNegative: boolean;
    pipeItems: readonly PipeOption[];
    paidFromPipeItems: readonly PipeOption[];
    paidFromGroups: PipeGroups;
    showPaidFrom: boolean;
    setShowPaidFrom: (show: boolean) => void;
  } | null;
   transaction: { paidFrom: { label: string; items: readonly PipeOption[]; groups: PipeGroups } | null } | null;
  boiler: { name: string; contributionAmount: number; currentFedChanged: boolean } | null;
};

export function buildAmountForm(configuration: AmountFormConfiguration, sourcePicker?: SourcePicker) {
  const { common, spend, boiler, transaction, pipesById } = configuration;
  const { form, page, row, input } = formBuilder<AmountFormDraft>({ defaults: { disabled: common.loading } });

  const sourcePage = sourcePicker && page(0,
    row(
      input("sourcePipeId", {
        type: "select",
        accessibilityLabel: "Transaction pipe",
        items: transactionPipeItems(sourcePicker.pipes, pipesById, true),
        groups: sourcePicker.groups,
        renderItem: renderTransactionPipe,
        itemStyle: transactionPipeStyle,
        loading: sourcePicker.loading,
      }),
    ),
  );

  const modeRow = spend && row(
    input("modeTransfer", {
      type: "toggle",
      options: [
        { label: "Transaction", icon: "upload" },
        { label: "Transfer", icon: "repeat" },
      ],
    })
  );

  const paidFromRow = transaction?.paidFrom && row(
    input("paidFrom", {
      type: "select",
      label: transaction.paidFrom.label,
      items: transactionPipeItems(transaction.paidFrom.items, pipesById),
      groups: transaction.paidFrom.groups,
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
      placeholder: "None",
    })
  );
  const spendRow = spend?.mode === "spend" && row(
    input("paidFrom", {
      type: "select",
      label: spend.isNegative ? "Paid from" : "Refunded to",
      items: transactionPipeItems(spend.paidFromPipeItems, pipesById),
      groups: spend.paidFromGroups,
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
      placeholder: "None",
    }, {
      reveal: {
        label: "Paid from another pipe?",
        icon: "wallet-outline",
        expanded: spend.showPaidFrom,
        onReveal: () => spend.setShowPaidFrom(true),
      },
    }),
  );
  const transferRow = spend?.mode === "transfer" && row(
    input("sentTo", {
      type: "select",
      label: "Transfer to",
      placeholder: "None",
      items: transactionPipeItems(spend.pipeItems, pipesById),
      renderItem: renderTransactionPipe,
      itemStyle: transactionPipeStyle,
    }),
  );
  const externalPipeRow = paidFromRow ?? spendRow ?? transferRow;

  const boilerRow = boiler && row(
    input("currentFed", {
      type: "decimal",
      label: `Current in ${boiler.name}`,
      allowNegative: false,
    },
    {
      description: boiler.contributionAmount > 0 && !boiler.currentFedChanged ? (
        <Text testID="boiler-growth-hint" className="text-xs text-muted">
          <Text testID="boiler-growth-amount" className="font-bold">+{formatAmount(boiler.contributionAmount)}:</Text>{" "}
          current will also grow by {formatAmount(boiler.contributionAmount)} after this operation, unless manually modified
        </Text>
      ) : undefined,
    }),
  );

  const titleRow = row(
    input("title", {
      type: "text-select",
      options: common.recentTitles,
      maxLength: 140,
      multiline: true,
      placeholder: "What was this for?",
    }),
  );

  const valueDateRow = row(
    input("value", {
      type: "decimal",
      label: configuration.isFeed ? "Amount" : "Value",
      placeholder: "0.00",
      allowNegative: !configuration.isFeed,
    }),
    input("date", { type: "date", label: "Date" }),
  );

  return form(
    sourcePage,
    page(1,
      modeRow,
      titleRow,
      valueDateRow,
      externalPipeRow,
      boilerRow,
    ),
  );
}
