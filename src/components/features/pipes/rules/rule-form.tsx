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

  const settlementUpdate = selectedRule === "cron" ? effectiveCron.capUpdateValue : capNumber;
  const unitOpts = UNIT_OPTIONS.find(option => option.id === draft.unit)?.id ?? "months";
  const pacingOptions = getPacingOptions(unitOpts);
  const elapsed = computeElapsedIntervals(draft.starting.getTime(), effectiveCron.interval, effectiveCron.unit, now);

  const { deletionDate, capValue, interval, unit, pacing, starting } = {
    deletionDate: input("deletionDate",
      {
        type: "date",
        label: "Destruct date",
        placeholder: "Select deletion date",
        validator: value => validateDeletionDate(value, now),
      },
      {
        description: `Settles and deletes automatically on or after this date.
Usually runs at 05:00 UTC.`,
      },
    ),
    capValue: input("capValue",
      {
        type: "decimal",
        label: "Cap update",
        allowNegative: true,
        placeholder: "Keep capacity unchanged",
        validator: validateCap,
      },
      {
        description: settlementUpdate == null ? `After settlement: capacity stays at ${formatAmount(capacity)}.`
          : `After settlement: capacity will become whatever funds are left ${settlementUpdate >= 0 ? 'plus ' + formatAmount(settlementUpdate) : 'minus ' + formatAmount(-settlementUpdate)}.`,
      },
    ),
    interval: input("interval", { type: "number", label: "Interval", min: 1, step: 1, validator: validateInterval }),
    unit: input("unit", { type: "select", label: "Unit", items: UNIT_OPTIONS, renderItem: item => <Text className="text-text">{item.label}</Text> }, { grow: 2 }),
    pacing: input("pacing",
      {
        type: "select",
        label: "Spread over",
        placeholder: "-",
        items: pacingOptions,
        disabled: disabled || pacingOptions.length === 0,
        renderItem: item => <Text className="text-text">{item.label}</Text>,
      },
      {
        description: draft.pacing && capNumber != null && capNumber !== 0
          ? <View className="gap-1">
              <Text className="text-warning text-sm">Saves as {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} every {effectiveCron.interval} {unitPlural(effectiveCron.interval, effectiveCron.unit)}.</Text>
              {effectiveCron.pacingDrift ? <Text className="text-warning text-xs">Rounding drift of {formatMoneyInput(effectiveCron.pacingDrift)}.</Text> : null}
            </View>
          : undefined,
      },
    ),
    starting: input("starting",
      { type: "date", label: "Starting date" },
      {
        grow: 2,
        description: shouldShowCapWarning({ isCron: true, capNumber: effectiveCron.capUpdateValue, elapsedIntervals: elapsed })
          ? <View className="bg-warning/10 border border-warning rounded-lg p-3">
              <Text className="text-warning text-sm">
                Saving adds {formatCapCredit(elapsed, effectiveCron.capUpdateValue)} capacity for the {elapsed} {unitPlural(elapsed, effectiveCron.unit)} since the starting date.
              </Text>
            </View>
          : undefined,
      },
    ),
  };

  switch (selectedRule) {
    case 'none':
      return [];
    case 'self_destruct':
      return [row(deletionDate)];
    case 'cron':
      return [
        row(interval, unit),
        row(pacing, starting),
        row(capValue),
      ];
    default:
      return [row(capValue)]
  };
}
