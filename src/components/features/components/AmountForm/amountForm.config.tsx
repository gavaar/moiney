import { Text } from "react-native";
import { formatAmount } from "@/lib/format";
import type { FormPage, FormRow } from "@ui/Form";
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

export function buildAmountForm(form: AmountFormConfiguration, sourcePicker?: SourcePicker) {
  const { common, spend, boiler, transaction, pipesById } = form;
  const pages: FormPage<AmountFormDraft>[] = [];

  if (sourcePicker) pages.push({
    key: 0,
    rows: [
      [
        {
          key: "sourcePipeId",
          input: {
            type: "select",
            accessibilityLabel: "Transaction pipe",
            items: transactionPipeItems(sourcePicker.pipes, pipesById, true),
            groups: sourcePicker.groups,
            renderItem: renderTransactionPipe,
            itemStyle: transactionPipeStyle,
            loading: sourcePicker.loading,
            disabled: common.loading,
          },
        }
      ]
    ],
  });

  const rows: FormRow<AmountFormDraft>[] = [];
  if (spend) rows.push([
    {
      key: "modeTransfer",
      input: {
        type: "toggle",
        options: [
          { label: "Transaction", icon: "upload" },
          { label: "Transfer", icon: "repeat" },
        ],
        disabled: common.loading,
      },
    }
  ]);

  rows.push(
    [
      {
        key: "title",
        input: {
          type: "text-select",
          options: common.recentTitles,
          maxLength: 140,
          multiline: true,
          placeholder: "What was this for?",
          disabled: common.loading,
        }
      }
    ],
    [
      {
        key: "value",
        input: {
          type: "decimal",
          label: form.isFeed ? "Amount" : "Value",
          placeholder: "0.00",
          allowNegative: !form.isFeed,
          disabled: common.loading,
        },
      },
      {
        key: "date",
        input: {
          type: "date",
          label: "Date",
          disabled: common.loading,
        },
      },
    ],
  );

  const paidFrom = transaction?.paidFrom;
  if (paidFrom || spend?.mode === "spend") rows.push([
    {
      key: "paidFrom",
      input: {
        type: "select",
        label: paidFrom?.label ?? (spend?.isNegative ? "Paid from" : "Refunded to"),
        items: transactionPipeItems(paidFrom?.items ?? spend?.paidFromPipeItems ?? [], pipesById),
        groups: paidFrom?.groups ?? spend?.paidFromGroups,
        renderItem: renderTransactionPipe,
        itemStyle: transactionPipeStyle,
        placeholder: "None",
        disabled: common.loading,
      },
      ...(!paidFrom && spend ? {
        reveal: {
          label: "Paid from another pipe?",
          icon: "wallet-outline" as const,
          expanded: spend.showPaidFrom,
          onReveal: () => spend.setShowPaidFrom(true),
        },
      } : {}),
    }
  ]);

  if (spend?.mode === "transfer") rows.push([
    {
      key: "sentTo",
      input: {
        type: "select",
        label: "Transfer to",
        placeholder: "None",
        disabled: common.loading,
        items: transactionPipeItems(spend.pipeItems, pipesById),
        renderItem: renderTransactionPipe,
        itemStyle: transactionPipeStyle,
      },
    }
  ]);

  if (boiler) rows.push([
    {
      key: "currentFed",
      input: {
        type: "decimal",
        label: `Current in ${boiler.name}`,
        allowNegative: false,
        disabled: common.loading,
      },
      description: boiler.contributionAmount > 0 && !boiler.currentFedChanged ? (
        <Text testID="boiler-growth-hint" className="text-xs text-muted">
          <Text testID="boiler-growth-amount" className="font-bold">+{formatAmount(boiler.contributionAmount)}:</Text>{" "}
        current will also grow by {formatAmount(boiler.contributionAmount)} after this operation, unless manually modified
        </Text>
      ) : undefined,
    }
  ]);
  pages.push({ key: 1, rows });

  return pages;
}
