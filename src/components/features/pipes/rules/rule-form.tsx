import { Text, View } from "react-native";
import { formBuilder, type FormRow } from "@ui/Form";
import { formatAmount } from "@/lib/format";
import { formatMoneyInput } from "@domain/money";
import { computeElapsedIntervals } from "@domain/scheduling";
import { UNIT_OPTIONS } from "./config";
import { formatCapCredit, getPacingOptions, shouldShowCapWarning, unitPlural } from "./helpers";
import { ruleDraftValues, validateCap, validateInterval, validateDeletionDate, type RuleDraft } from "./rule-draft";

/** Rule-specific fields only; the pipe type selector owns rule selection. */
export function buildRuleRows(draft: RuleDraft, { capacity, disabled, now }: {
  capacity: number; disabled?: boolean; now: number;
}): readonly FormRow<Omit<RuleDraft, "selectedRule">>[] {
  const { selectedRule, capNumber, effectiveCron } = ruleDraftValues(draft);
  const { row, input } = formBuilder<Omit<RuleDraft, "selectedRule">>({ defaults: { disabled } });
  if (selectedRule === "none") return [];
  if (selectedRule === "self_destruct") return [
    row(input("deletionDate", {
      type: "date", label: "Destruct date", placeholder: "Select deletion date", validator: value => validateDeletionDate(value, now),
    }, { description: "Settles and deletes automatically on or after this date, not at an exact time." })),
  ];
  const settlementUpdate = selectedRule === "cron" ? effectiveCron.capUpdateValue : capNumber;
  const capRow = row(input("capValue", {
    type: "decimal", label: "Cap update", allowNegative: true, placeholder: "Keep capacity unchanged", validator: validateCap,
  }, {
    description: settlementUpdate == null ? `Blank keeps capacity at ${formatAmount(capacity)} after settlement. Zero is different from blank.`
      : `After settlement: capacity − spending + ${formatAmount(settlementUpdate)}. With no spending, capacity becomes ${formatAmount(capacity + settlementUpdate)}.`,
  }));
  if (selectedRule !== "cron") return [capRow];
  const unit = UNIT_OPTIONS.find(option => option.id === draft.unit)?.id ?? "months";
  const pacingOptions = getPacingOptions(unit);
  const elapsed = computeElapsedIntervals(draft.starting.getTime(), effectiveCron.interval, effectiveCron.unit, now);
  return [
    row(input("interval", { type: "number", label: "Interval", min: 1, step: 1, validator: validateInterval }),
      input("unit", { type: "select", label: "Unit", items: UNIT_OPTIONS, renderItem: item => <Text className="text-text">{item.label}</Text> })),
    row(input("starting", { type: "date", label: "Starting date" }, {
      description: shouldShowCapWarning({ isCron: true, capNumber: effectiveCron.capUpdateValue, elapsedIntervals: elapsed })
        ? <View className="bg-warning/10 border border-warning rounded-lg p-3"><Text className="text-warning text-sm">
          Saving adds {formatCapCredit(elapsed, effectiveCron.capUpdateValue)} capacity for the {elapsed} {unitPlural(elapsed, effectiveCron.unit)} since the starting date.
        </Text></View> : undefined,
    }), input("pacing", {
      type: "select",
      label: "Spread into installments",
      placeholder: "No installments",
      items: pacingOptions,
      disabled: disabled || capNumber == null || capNumber === 0 || pacingOptions.length === 0,
      renderItem: item => <Text className="text-text">{item.label}</Text>,
    }, {
      description: draft.pacing && capNumber != null && capNumber !== 0 ? <View className="gap-1">
        <Text className="text-muted text-sm">Saves as {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} every {effectiveCron.interval} {unitPlural(effectiveCron.interval, effectiveCron.unit)}.</Text>
        {effectiveCron.pacingDrift ? <Text className="text-warning text-xs">Rounding drift: {formatMoneyInput(effectiveCron.pacingDrift)} over the selected interval.</Text> : null}
      </View> : undefined,
    })),
    capRow,
  ];
}
