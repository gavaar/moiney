import { Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { formBuilder, type FormRow } from "@ui/Form";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { formatMoneyInput } from "@domain/money";
import { computeElapsedIntervals } from "@domain/scheduling";
import { RULE_OPTIONS, RULE_DESCRIPTIONS, UNIT_OPTIONS } from "./config";
import { formatCapCredit, getPacingOptions, shouldShowCapWarning, unitPlural } from "./helpers";
import { ruleDraftValues, validateCap, validateInterval, validateDeletionDate, type RuleDraft } from "./rule-draft";

export function buildRuleRows(
  draft: RuleDraft,
  { capacity, disabled, allowSelfDestruct, now }: {
    capacity: number; disabled?: boolean; allowSelfDestruct?: boolean; now: number;
  }): readonly FormRow<RuleDraft>[]
{
  const { selectedRule, capNumber, effectiveCron } = ruleDraftValues(draft);
  const { row, input } = formBuilder<RuleDraft>({ defaults: { disabled } });
  const rows: FormRow<RuleDraft>[] = [
    row(
      input("selectedRule", {
        type: "select",
        label: "Rule",
        items: RULE_OPTIONS.filter((option) => allowSelfDestruct !== false || option.id !== "self_destruct"),
        renderItem: (item) => <View className="flex-row items-center gap-2">
          <Icon name={item.icon} size={16} color={item.id === "self_destruct" ? colors.error : colors.text} />
          <Text className="text-text text-base">{item.label}</Text>
        </View>,
      },
      {
        description: <>
          <Text className="text-xs italic text-muted">{RULE_DESCRIPTIONS[selectedRule]}</Text>
          {selectedRule === "cron" && effectiveCron.pacingDrift ? <Text className="text-xs text-warning">
          This pacing rounds to {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} per period
          and drifts by {formatMoneyInput(effectiveCron.pacingDrift)} over the selected interval.
          </Text> : null}
        </>,
      }),
    ),
  ];

  if (selectedRule === "self_destruct") {
    rows.push(
      row(
        input("deletionDate", {
          type: "date",
          label: "Deletion date",
          placeholder: "Select deletion date",
          validator: (value) => validateDeletionDate(value, now),
        }),
      ),
    );
  } else if (selectedRule !== "none") {
    rows.push(
      row(
        input("capValue", {
          type: "decimal",
          label: "Cap update",
          allowNegative: true,
          placeholder: `reset cap to ${formatAmount(capacity)}`,
          validator: validateCap,
        },
        {
          description: <Text className="text-xs italic text-muted">{capNumber != null
            ? `Cap will update leftover value by ${formatAmount(capNumber)} after every rule run.`
            : `Cap will reset to ${formatAmount(capacity)} after every rule run.`}</Text>,
        }),
      ),
    );
  }

  if (selectedRule === "cron") {
    const unit = UNIT_OPTIONS.find((option) => option.id === draft.unit)?.id ?? "months";
    const pacingOptions = getPacingOptions(unit);
    const elapsed = computeElapsedIntervals(draft.starting.getTime(), effectiveCron.interval, effectiveCron.unit, now);

    rows.push(
      row(
        input("interval", { type: "number", label: "Interval", min: 1, step: 1, validator: validateInterval }),
        input("unit", {
          type: "select",
          label: "Unit",
          items: UNIT_OPTIONS,
          renderItem: (item) => <Text className="text-text text-base">{item.label}</Text>,
        }),
      ),
      row(
        input("pacing", {
          type: "select",
          label: "Pacing",
          items: pacingOptions,
          placeholder: "Select pacing...",
          disabled: disabled || capNumber == null || capNumber === 0 || pacingOptions.length === 0,
          renderItem: (item) => <Text className="text-text text-base">{item.label}</Text>,
        },
        {
          description: draft.pacing && capNumber != null && capNumber !== 0 ?
            <Text className="text-sm text-muted">
              Capacity will update by {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} every {unitPlural(1, effectiveCron.unit)}.
            </Text> : undefined,
        }),
      ),
      row(
        input("starting",
          { type: "date", label: "Starting date" },
          {
            description: shouldShowCapWarning({ isCron: true, capNumber: effectiveCron.capUpdateValue, elapsedIntervals: elapsed }) ?
              <View className="bg-warning/10 border border-warning rounded-lg p-3"><Text className="text-warning text-sm">
                saving this rule will automatically add {formatCapCredit(elapsed, effectiveCron.capUpdateValue)} cap to account for the{" "}
                {elapsed} {unitPlural(elapsed, effectiveCron.unit)} that have passed from the starting date
              </Text></View> : undefined,
          },
        ),
      ),
    );
  }

  return rows;
}
