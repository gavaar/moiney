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
import { computeElapsedIntervals, type CronUnit } from "@convex/lib/pipes";
import {
  RULE_DESCRIPTIONS,
  RULE_OPTIONS,
  UNIT_OPTIONS,
  type RuleId,
} from "./config";
import {
  formatCapCredit,
  getActionConfig,
  hasRuleDiff,
  parseCapValue,
  shouldShowCapWarning,
  todayMidday,
  unitPlural,
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
    pipe?.capUpdateValue != null ? String(pipe.capUpdateValue) : "",
  );
  const [interval, setInterval] = useState<number>(pipe?.cronInterval?.interval ?? 1);
  const [unit, setUnit] = useState<CronUnit>(pipe?.cronInterval?.unit ?? "months");
  const [starting, setStarting] = useState<Date>(() =>
    pipe?.cronNextDate != null ? new Date(pipe.cronNextDate) : todayMidday(),
  );
  const [isBusy, setIsBusy] = useState(false);

  const isCron = selectedRule === "cron";

  const capNumber = useMemo(() => parseCapValue(capValue), [capValue]);

  const hasDiff = useMemo(
    () => hasRuleDiff({ selectedRule, isCron, capNumber, interval, unit, pipe }),
    [selectedRule, isCron, capNumber, interval, unit, pipe],
  );

  const elapsedIntervals = useMemo(() => {
    if (!isCron) return 0;
    return computeElapsedIntervals(starting.getTime(), interval, unit);
  }, [isCron, starting, interval, unit]);

  const capCredit = formatCapCredit(elapsedIntervals, capNumber);
  const showWarning = shouldShowCapWarning({ isCron, capNumber, elapsedIntervals });

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
          interval,
          unit,
          starting: starting.getTime(),
          capUpdateValue: capNumber,
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
    interval,
    unit,
    starting,
    capNumber,
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

          {isCron ? (
            <>
              <Input
                type="decimal"
                label="Cap update"
                value={capValue}
                onChange={setCapValue}
                placeholder="0.00"
              />

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
                    onSelect={(u) => setUnit(u as CronUnit)}
                  />
                </View>
              </View>

              <Input
                type="datetime"
                mode="date"
                label="Starting date"
                value={starting}
                onChange={setStarting}
              />

              {showWarning ? (
                <View className="bg-warning/10 border border-warning rounded-lg p-3">
                  <Text className="text-warning text-sm">
                    saving this rule will automatically add {capCredit} cap to account for the{" "}
                    {elapsedIntervals} {unitPlural(elapsedIntervals, unit)} that have passed from
                    the starting date
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}
        </View>
      </ScrollView>

      <View className="flex-row gap-2 mt-4">
        <Button className="flex-1" title="Cancel" variant="muted" onPress={onClose} />
        <Button
          className="flex-[2_1_0]"
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
