import { Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import type { FormProps } from "@ui/Form";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { formatMoneyInput, parseMoney } from "@domain/money";
import { computeElapsedIntervals } from "@domain/scheduling";
import { selfDestructDeadline } from "@domain/pipes/rules";
import type { PipeModel } from "@features/pipes/data/pipes";
import { RULE_OPTIONS, RULE_DESCRIPTIONS, UNIT_OPTIONS } from "./config";
import { buildRuleConfiguration, calculateEffectiveCron, formatCapCredit, getPacingOptions,
  parseCapValue, shouldShowCapWarning, todayMidday, unitPlural } from "./helpers";

export type RuleDraft = {
  selectedRule: string;
  capValue: string;
  interval: number;
  unit: string;
  pacing: string | null;
  starting: Date;
  deletionDate: Date | null;
};

export function createRuleDraft(pipe?: PipeModel): RuleDraft {
  return {
    selectedRule: pipe?.rule ?? "none",
    capValue: pipe?.capUpdateValue === undefined ? "" : formatMoneyInput(pipe.capUpdateValue),
    interval: pipe?.rule === "cron" ? pipe.cronInterval?.interval ?? 1 : 1,
    unit: pipe?.rule === "cron" ? pipe.cronInterval?.unit ?? "months" : "months",
    pacing: null,
    starting: pipe?.rule === "cron" && pipe.cronNextDate !== undefined ? new Date(pipe.cronNextDate) : todayMidday(),
    deletionDate: pipe?.rule === "self_destruct" && pipe.cronNextDate !== undefined ? new Date(pipe.cronNextDate) : null,
  };
}

export function mergeRuleDraft<T extends RuleDraft>(previous: T, next: Partial<T>): T {
  const merged = { ...previous, ...next };
  const unit = UNIT_OPTIONS.find((option) => option.id === merged.unit)?.id ?? "months";
  if (!getPacingOptions(unit).some((option) => option.id === merged.pacing)) merged.pacing = null;
  return merged;
}

export function ruleDraftValues(draft: RuleDraft) {
  const selectedRule = RULE_OPTIONS.find((option) => option.id === draft.selectedRule)?.id ?? "none";
  const unit = UNIT_OPTIONS.find((option) => option.id === draft.unit)?.id ?? "months";
  const pacing = draft.pacing === "months" || draft.pacing === "years" ? draft.pacing : undefined;
  const capNumber = parseCapValue(draft.capValue);
  return {
    selectedRule, capNumber,
    effectiveCron: calculateEffectiveCron({ capUpdateValue: capNumber, interval: draft.interval, unit, pacing }),
    starting: selectedRule === "self_destruct" ? draft.deletionDate?.getTime() ?? NaN : draft.starting.getTime(),
  };
}

export function ruleConfigurationFromDraft(draft: RuleDraft) {
  return buildRuleConfiguration(ruleDraftValues(draft));
}

function validateCap(value: string) {
  if (!value.trim()) return undefined;
  try { parseMoney(value); return undefined; } catch { return "Enter a valid capacity update"; }
}
function validateInterval(value: number) {
  return Number.isSafeInteger(value) && value > 0 ? undefined : "Enter a positive whole interval";
}
export function validateDeletionDate(value: Date | null, now: number) {
  const deadline = value ? selfDestructDeadline(value.getTime()) : NaN;
  return Number.isFinite(deadline) && deadline > now ? undefined : "Choose a future deletion date (05:00 UTC)";
}

export function validateRuleDraft(draft: RuleDraft, now: number): string | undefined {
  if (draft.selectedRule === "self_destruct") return validateDeletionDate(draft.deletionDate, now);
  if (draft.selectedRule === "none") return undefined;
  const capError = validateCap(draft.capValue);
  if (capError) return capError;
  if (draft.selectedRule === "cron") return validateInterval(draft.interval) ??
    (Number.isFinite(draft.starting.getTime()) ? undefined : "Choose a starting date");
  return undefined;
}

export function buildRuleFields(
  draft: RuleDraft,
  { capacity, disabled, allowSelfDestruct, step, now }: {
    capacity: number; disabled?: boolean; allowSelfDestruct?: boolean; step?: number; now: number;
  }): FormProps<RuleDraft>["form"]
{
  const { selectedRule, capNumber, effectiveCron } = ruleDraftValues(draft);
  const fields: FormProps<RuleDraft>["form"][number][] = [{
    key: "selectedRule",
    input: {
      type: "select", label: "Rule", disabled,
      items: RULE_OPTIONS.filter((option) => allowSelfDestruct !== false || option.id !== "self_destruct"),
      renderItem: (item) => <View className="flex-row items-center gap-2">
        <Icon name={item.icon} size={16} color={item.id === "self_destruct" ? colors.error : colors.text} />
        <Text className="text-text text-base">{item.label}</Text>
      </View>,
    },
    description: <>
      <Text className="text-xs italic text-muted">{RULE_DESCRIPTIONS[selectedRule]}</Text>
      {selectedRule === "cron" && effectiveCron.pacingDrift ? <Text className="text-xs text-warning">
        This pacing rounds to {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} per period
        and drifts by {formatMoneyInput(effectiveCron.pacingDrift)} over the selected interval.
      </Text> : null}
    </>,
  }];

  if (selectedRule === "self_destruct") {
    fields.push({
      key: "deletionDate",
      input: {
        type: "date",
        label: "Deletion date",
        placeholder: "Select deletion date",
        disabled,
        validator: (value) => validateDeletionDate(value, now),
      }
    });
  } else if (selectedRule !== "none") {
    fields.push({
      key: "capValue",
      input: {
        type: "decimal",
        label: "Cap update",
        disabled,
        allowNegative: true,
        placeholder: `reset cap to ${formatAmount(capacity)}`,
        validator: validateCap,
      },
      description: <Text className="text-xs italic text-muted">{capNumber != null
        ? `Cap will update leftover value by ${formatAmount(capNumber)} after every rule run.`
        : `Cap will reset to ${formatAmount(capacity)} after every rule run.`}</Text>
    });
  }

  if (selectedRule === "cron") {
    const unit = UNIT_OPTIONS.find((option) => option.id === draft.unit)?.id ?? "months";
    const pacingOptions = getPacingOptions(unit);
    const elapsed = computeElapsedIntervals(draft.starting.getTime(), effectiveCron.interval, effectiveCron.unit, now);
    fields.push(
      {
        key: "interval",
        row: "schedule",
        input: {
          type: "number",
          label: "Interval",
          min: 1,
          step: 1,
          disabled,
          validator: validateInterval
        },
      },
      {
        key: "unit",
        row: "schedule",
        input: {
          type: "select",
          label: "Unit",
          disabled,
          items: UNIT_OPTIONS,
          renderItem: (item) => <Text className="text-text text-base">{item.label}</Text>
        },
      },
      {
        key: "pacing",
        input: {
          type: "select",
          label: "Pacing",
          items: pacingOptions,
          placeholder: "Select pacing...",
          disabled: disabled || capNumber == null || capNumber === 0 || pacingOptions.length === 0,
          renderItem: (item) => <Text className="text-text text-base">{item.label}</Text>
        },
        description: draft.pacing && capNumber != null && capNumber !== 0 ?
          <Text className="text-sm text-muted">
            Capacity will update by {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} every {unitPlural(1, effectiveCron.unit)}.
          </Text> : undefined
        },
      {
        key: "starting",
        input: {
          type: "date",
          label: "Starting date",
          disabled,
        },
        description: shouldShowCapWarning({ isCron: true, capNumber: effectiveCron.capUpdateValue, elapsedIntervals: elapsed }) ?
          <View className="bg-warning/10 border border-warning rounded-lg p-3"><Text className="text-warning text-sm">
            saving this rule will automatically add {formatCapCredit(elapsed, effectiveCron.capUpdateValue)} cap to account for the{" "}
            {elapsed} {unitPlural(elapsed, effectiveCron.unit)} that have passed from the starting date
          </Text></View> : undefined
      },
    );
  }
  return fields.map((field) => ({ ...field, step }));
}
