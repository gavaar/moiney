import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Id } from "@convex/_generated/dataModel";
import { formatAmount } from "@/lib/format";
import { cn, colors } from "@/lib/styles";
import { Icon, type IconName } from "@ui/Icon";
import { Input } from "@ui/Input";
import { SlideToggle } from "@ui/SlideToggle";
import type { AmountFormProps } from "./types";
import { useAmountFormController } from "./useAmountFormController";

function renderPipeItem(item: { id: string } & Record<string, any>) {
  return (
    <View className="flex-row items-center gap-2">
      <Icon name={item.icon as IconName} size={16} color={colors.text} />
      <Text className="text-text">{item.name}</Text>
    </View>
  );
}

export function AmountForm(props: AmountFormProps) {
  const form = useAmountFormController(props);
  const { action, boiler, common, spend, transaction } = form;
  const transactionSummary =
    transaction &&
    transaction.intent !== "edit" &&
    transaction.initial.spent !== undefined &&
    transaction.initial.capacity !== undefined
      ? ` (${formatAmount(transaction.initial.spent)} / ${formatAmount(transaction.initial.capacity)})`
      : "";
  const transactionIntentLabel =
    transaction?.intent === "edit"
      ? "edit"
      : transaction?.intent === "create"
        ? "create"
        : "repeat";

  return (
    <View className="px-4 py-4 gap-2">
      {transaction ? (
        <View
          accessibilityRole="header"
          accessibilityLabel={
            transaction.intent === "edit"
              ? `Edit: ${transaction.initial.pipeName} ${transaction.initial.title}`
              : `${transaction.intent === "create" ? "Create: " : ""}${transaction.initial.pipeName}${transactionSummary}`
          }
          className="flex-row items-center justify-between gap-2 border-b border-muted/20 p-2"
        >
          <View className="flex-1 flex-row items-center gap-2">
            <Icon
              name={transaction.initial.pipeIcon}
              size={24}
              color={colors.muted}
            />
            <Text className="flex-1 text-md font-medium text-muted" numberOfLines={1}>
              {transaction.initial.pipeName}
              {transactionSummary}
              {transaction.intent === "edit"
                ? `: ${transaction.initial.title}`
                : ""}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Text className="text-sm text-muted">
              {transactionIntentLabel}
            </Text>
            <Icon
              name={
                transaction.intent === "edit"
                  ? "pencil-outline"
                  : transaction.intent === "create"
                    ? "add-circle-outline"
                    : "repeat-once"
              }
              size={18}
              color={colors.muted}
            />
          </View>
        </View>
      ) : null}

      {spend ? (
        <View className="flex-row items-center justify-between">
          <Text className="text-sm text-text">
            {spend.mode === "spend" ? "Add transaction" : "Transfer"}
          </Text>
          <SlideToggle
            options={[
              { value: "spend", label: "Spend", icon: "upload" },
              { value: "transfer", label: "Transfer", icon: "repeat" },
            ]}
            value={spend.mode}
            onChange={spend.updateMode}
          />
        </View>
      ) : null}

      <Input
        type="text-select"
        value={common.title}
        onChangeText={common.setTitle}
        onOptionSelect={common.setTitle}
        options={common.recentTitles}
        maxLength={140}
        multiline
        placeholder="What was this for?"
        disabled={common.loading}
      />

      <View className="flex-row gap-4">
        <View className="flex-1">
          <Input
            type="decimal"
            label={form.isFeed ? "Amount" : "Value"}
            value={common.value}
            onChange={common.setValue}
            placeholder="0.00"
            allowNegative={!form.isFeed}
            disabled={common.loading}
          />
        </View>
        <View className="flex-1">
          <Input
            type="date"
            label="Date"
            value={common.date}
            onChange={common.setDate}
            disabled={common.loading}
          />
        </View>
      </View>

      {transaction?.paidFrom ? (
        <Input
          type="select"
          label={transaction.paidFrom.label}
          value={transaction.paidFrom.value}
          onSelect={(id) =>
            transaction.paidFrom?.setValue(
              id ? (id as Id<"pipes">) : null,
            )
          }
          items={transaction.paidFrom.items}
          renderItem={renderPipeItem}
          placeholder="None"
          disabled={common.loading || transaction.intent === "edit"}
        />
      ) : null}

      {boiler ? (
        <View className="gap-1">
          <Input
            type="decimal"
            label={`Current in ${boiler.name}`}
            value={boiler.value}
            onChange={boiler.setValue}
            allowNegative={false}
            disabled={common.loading}
          />
          {boiler.contributionAmount > 0 && !boiler.currentFedChanged ? (
            <Text testID="boiler-growth-hint" className="text-xs text-muted">
              <Text testID="boiler-growth-amount" className="font-bold">
                +{formatAmount(boiler.contributionAmount)}:
              </Text>{" "}
              current will also grow by {formatAmount(boiler.contributionAmount)} after this operation, unless manually modified
            </Text>
          ) : null}
        </View>
      ) : null}

      {spend?.mode === "transfer" ? (
        <Input
          type="select"
          label="Transfer to"
          value={spend.sentToPipeId}
          onSelect={(id) =>
            spend.setSentToPipeId(id ? (id as Id<"pipes">) : null)
          }
          items={spend.pipeItems}
          renderItem={renderPipeItem}
          placeholder="None"
        />
      ) : null}

      {spend?.mode === "spend" ? (
        spend.showPaidFrom ? (
          <Input
            type="select"
            label={spend.isNegative ? "Paid from" : "Refunded to"}
            value={spend.paidFromPipeId}
            onSelect={(id) =>
              spend.setPaidFromPipeId(id ? (id as Id<"pipes">) : null)
            }
            items={spend.paidFromPipeItems}
            renderItem={renderPipeItem}
            placeholder="None"
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Paid from another pipe?"
            onPress={() => spend.setShowPaidFrom(true)}
            className="self-start flex-row items-center gap-1 py-1 opacity-50"
          >
            <Icon name="wallet-outline" size={14} color={colors.muted} />
            <Text className="text-xs text-muted">Paid from another pipe?</Text>
          </Pressable>
        )
      ) : null}

      <View className="flex-row items-center justify-between gap-3 pt-2">
        <TouchableOpacity
          testID="eraser-button"
          accessibilityRole="button"
          accessibilityLabel="Clear form"
          accessibilityState={{ disabled: common.loading }}
          onPress={common.reset}
          disabled={common.loading}
          className={cn(
            "p-3 border border-muted rounded-full",
            common.loading && "opacity-50",
          )}
        >
          <Icon name="eraser" size={20} color={colors.muted} />
        </TouchableOpacity>

        <Pressable
          testID="submit-button"
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{
            disabled: !action.isValid || action.loading,
            busy: action.loading,
          }}
          aria-busy={action.loading}
          onPress={action.submit}
          disabled={!action.isValid || action.loading}
          className={cn(
            "rounded-lg border px-5 py-3 flex-row items-center gap-2",
            action.isValid && !action.loading ? "" : "opacity-50",
            action.style.border,
          )}
        >
          {action.loading ? (
            <ActivityIndicator
              accessibilityLabel={`Submitting ${action.label}`}
              color={action.style.iconColor}
            />
          ) : (
            <>
              <Icon
                name={action.icon as IconName}
                size={20}
                color={action.style.iconColor}
              />
              <Text
                className={cn(
                  "font-semibold text-base",
                  action.style.textColor,
                )}
              >
                {action.label}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
