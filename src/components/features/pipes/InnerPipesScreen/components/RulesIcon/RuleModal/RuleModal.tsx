import { useCallback, useMemo, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import { type Id } from "@convex/_generated/dataModel";
import { Button } from "@ui/Button";
import { Input } from "@ui/Input";
import { Icon, type IconName } from "@ui/Icon";
import { ModalShell } from "@ui/Modal";
import { useAlert } from "@ui/Alert";
import { usePipeSelection } from "@features/pipes/context/PipeSelectionContext";
import { colors } from "@/lib/styles";
import { formatAmount } from "@/lib/format";
import { computeElapsedIntervals, type CronUnit } from "@domain/scheduling";
import { formatMoneyInput } from "@domain/money";
import {
  RULE_DESCRIPTIONS,
  RULE_OPTIONS,
  UNIT_OPTIONS,
  type RuleId,
} from "./config";
import {
  calculateEffectiveCron,
  formatCapCredit,
  getActionConfig,
  getPacingOptions,
  hasRuleDiff,
  parseCapValue,
  shouldShowCapWarning,
  todayMidday,
  unitPlural,
  type Pacing,
} from "./helpers";

type Props = {
  visible: boolean;
  onClose: () => void;
  pipeId: Id<"pipes">;
};

export function RuleModal({ visible, onClose, pipeId }: Props) {
  const { pipesById } = usePipeSelection();
  const pipe = pipesById?.[pipeId];
  const showAlert = useAlert();
  const updatePipeRule = useMutation(api.pipes.updatePipeRule);
  const executePipeRuleNow = useMutation(api.pipes.executePipeRuleNow);

  const [selectedRule, setSelectedRule] = useState<RuleId>(pipe?.rule ?? "none");
  const [capValue, setCapValue] = useState<string>(
    pipe?.capUpdateValue != null ? formatMoneyInput(pipe.capUpdateValue) : "",
  );
  const [interval, setInterval] = useState<number>(pipe?.cronInterval?.interval ?? 1);
  const [unit, setUnit] = useState<CronUnit>(pipe?.cronInterval?.unit ?? "months");
  const [pacing, setPacing] = useState<Pacing>();
  const [starting, setStarting] = useState<Date>(() =>
    pipe?.cronNextDate != null ? new Date(pipe.cronNextDate) : todayMidday(),
  );
  const [isBusy, setIsBusy] = useState(false);

  const isCron = selectedRule === "cron";

  const capNumber = useMemo(() => parseCapValue(capValue), [capValue]);
  const effectiveCron = useMemo(
    () => calculateEffectiveCron({ capUpdateValue: capNumber, interval, unit, pacing }),
    [capNumber, interval, unit, pacing],
  );

  const hasDiff = useMemo(
    () =>
      hasRuleDiff({
        selectedRule,
        isCron,
        capNumber: effectiveCron.capUpdateValue,
        interval: effectiveCron.interval,
        unit: effectiveCron.unit,
        starting: starting.getTime(),
        pipe,
      }),
    [selectedRule, isCron, effectiveCron, starting, pipe],
  );

  const elapsedIntervals = useMemo(() => {
    if (!isCron) return 0;
    return computeElapsedIntervals(
      starting.getTime(),
      effectiveCron.interval,
      effectiveCron.unit,
      Date.now(),
    );
  }, [isCron, starting, effectiveCron]);

  const capCredit = formatCapCredit(elapsedIntervals, effectiveCron.capUpdateValue);
  const showWarning = shouldShowCapWarning({
    isCron,
    capNumber: effectiveCron.capUpdateValue,
    elapsedIntervals,
  });
  const pacingOptions = getPacingOptions(unit);
  const showPacingPreview = pacing != null && capNumber != null && capNumber !== 0;

  const { title: actionTitle, variant: actionVariant, icon: actionIcon, disabled: actionDisabled } =
    getActionConfig({ hasDiff, isCron });

  const handleSave = useCallback(async () => {
    setIsBusy(true);
    try {
      if (selectedRule === "none") {
        await updatePipeRule({ pipeId, rule: undefined });
      } else if (isCron) {
        await updatePipeRule({
          pipeId,
          rule: "cron",
          interval: effectiveCron.interval,
          unit: effectiveCron.unit,
          starting: starting.getTime(),
          capUpdateValue: effectiveCron.capUpdateValue,
        });
      } else {
        await updatePipeRule({
          pipeId,
          rule: selectedRule,
          capUpdateValue: capNumber,
        });
      }
      if (isCron) onClose();
      else setIsBusy(false);
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : String(error));
      setIsBusy(false);
    }
  }, [
    selectedRule,
    isCron,
    pipeId,
    starting,
    capNumber,
    effectiveCron,
    updatePipeRule,
    onClose,
    showAlert,
  ]);

  const handleRunNow = useCallback(async () => {
    setIsBusy(true);
    try {
      await executePipeRuleNow({ pipeId });
      showAlert.success("Rule executed");
      onClose();
    } catch (error) {
      showAlert.error(error instanceof Error ? error.message : String(error));
      setIsBusy(false);
    }
  }, [pipeId, executePipeRuleNow, showAlert, onClose]);

  const handleAction = () => {
    if (hasDiff) return handleSave();
    if (isCron) return;
    return handleRunNow();
  };

  return (
    <ModalShell visible={visible} onClose={onClose}>
      <ScrollView style={{ flexGrow: 0 }}>
        <View className="gap-4">
          <View className="flex-row items-center gap-2">
            {pipe ? (
              <Icon name={pipe.icon as IconName} size={20} color={colors.muted} />
            ) : null}
            <Text className="text-muted text-lg">{pipe?.name ?? "Pipe"}</Text>
          </View>

          <Input
            type="select"
            label="Rule"
            items={RULE_OPTIONS}
            renderItem={(item) => (
              <View className="flex-row items-center gap-2">
                <Icon name={item.icon} size={16} color={colors.text} />
                <Text className="text-text text-base">{item.label}</Text>
              </View>
            )}
            value={selectedRule}
            onSelect={(id) => setSelectedRule(id as RuleId)}
          />

           <Text className="text-xs italic text-muted">
            {RULE_DESCRIPTIONS[selectedRule]}
           </Text>
           {effectiveCron.pacingDrift ? (
             <Text className="text-xs text-warning">
                This pacing rounds to {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} per period
                and drifts by {formatMoneyInput(effectiveCron.pacingDrift)} over the selected interval.
             </Text>
           ) : null}

          {selectedRule !== "none" ? (
            <>
              <Input
                type="decimal"
                label="Cap update"
                value={capValue}
                onChange={setCapValue}
                placeholder={`reset cap to ${formatAmount(pipe?.capacity ?? 0)}`}
              />

              <Text className="text-xs italic text-muted">
                {capNumber != null
                  ? `Cap will update leftover value by ${formatAmount(capNumber)} after every rule run.`
                  : `Cap will reset to ${formatAmount(pipe?.capacity ?? 0)} after every rule run.`}
              </Text>
            </>
          ) : null}

          {isCron ? (
            <>
              <View className="flex-row gap-4">
                <View className="flex-1">
                  <Input
                    type="number"
                    label="Interval"
                    value={interval}
                    onChange={setInterval}
                    min={1}
                    step={1}
                  />
                </View>
                <View className="flex-1">
                  <Input
                    type="select"
                    label="Unit"
                    items={UNIT_OPTIONS}
                    renderItem={(item) => (
                      <Text className="text-text text-base">{item.label}</Text>
                    )}
                    value={unit}
                    onSelect={(value) => {
                      const nextUnit = value as CronUnit;
                      setUnit(nextUnit);
                      if (!getPacingOptions(nextUnit).some((option) => option.id === pacing)) {
                        setPacing(undefined);
                      }
                    }}
                  />
                </View>
              </View>

              <Input
                type="select"
                label="Pacing"
                items={pacingOptions}
                renderItem={(item) => (
                  <Text className="text-text text-base">{item.label}</Text>
                )}
                value={pacing ?? null}
                onSelect={(value) => setPacing(value as Pacing)}
                placeholder="Select pacing..."
                disabled={capNumber == null || capNumber === 0 || pacingOptions.length === 0}
              />

              {showPacingPreview ? (
                <Text className="text-sm text-muted">
                    Capacity will update by {formatMoneyInput(effectiveCron.capUpdateValue ?? 0)} every{" "}
                  {unitPlural(1, effectiveCron.unit)}.
                </Text>
              ) : null}

              <Input
                type="date"
                label="Starting date"
                value={starting}
                onChange={setStarting}
              />

              {showWarning ? (
                <View className="bg-warning/10 border border-warning rounded-lg p-3">
                  <Text className="text-warning text-sm">
                    saving this rule will automatically add {capCredit} cap to account for the{" "}
                    {elapsedIntervals} {unitPlural(elapsedIntervals, effectiveCron.unit)} that have
                    passed from the starting date
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View className="mt-4">
        <Button
          title={actionTitle}
          variant={actionVariant}
          icon={actionIcon}
          disabled={actionDisabled}
          loading={isBusy}
          onPress={handleAction}
        />
      </View>
    </ModalShell>
  );
}
