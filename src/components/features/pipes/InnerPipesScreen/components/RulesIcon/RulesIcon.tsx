import { TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { Icon } from "@ui/Icon";
import { ProgressRing } from "@ui/ProgressRing";
import { colors } from "@/lib/styles";
import { type Id } from "@convex/_generated/dataModel";
import {
  computeCronIntervalProgress,
  type CronUnit,
} from "@domain/scheduling";
import { RuleModal } from "./RuleModal";
import { RULE_OPTIONS, type RuleId } from "@features/pipes/rules/config";
import { selfDestructProgress } from "@domain/pipes/rules";

type Props = {
  pipeId: Id<"pipes">;
  rule?: RuleId;
  fed: number;
  capacity: number;
  spent?: number;
  cronNextDate?: number;
  cronInterval?: { interval: number; unit: CronUnit };
  disabled?: boolean;
  now?: number;
};

export function RulesIcon({
  pipeId,
  rule,
  fed,
  capacity,
  spent,
  cronNextDate,
  cronInterval,
  disabled,
  now = Date.now(),
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const color = rule === "self_destruct" ? colors.error : fed >= capacity ? colors.secondary : colors.text;
  const ruleIcon =
    rule != null ? RULE_OPTIONS.find((o) => o.id === rule)?.icon : undefined;
  const icon =
    ruleIcon ?? (fed >= capacity ? "lock-closed-outline" : "lock-open-outline");

  const ringProgress =
    rule === "self_destruct" && cronNextDate !== undefined && cronInterval?.unit === "days"
      ? selfDestructProgress(cronNextDate, cronInterval.interval, now)
      : rule === "spend_overflow" && capacity > 0
      ? Math.min(1, Math.max(0, (spent ?? 0) / capacity))
      : rule === "cron" && cronNextDate != null && cronInterval
        ? computeCronIntervalProgress(
            cronNextDate,
            cronInterval.interval,
            cronInterval.unit,
            now,
          )
         : undefined;

  const ruleContent = (
    <View className="relative w-6 h-6" testID="rules-icon-box">
      {ringProgress !== undefined ? (
        <View className="absolute inset-0 items-center justify-center">
          <ProgressRing
            size={30}
            strokeWidth={1}
            progress={ringProgress}
            color={color}
          />
        </View>
      ) : null}
      <View className="absolute inset-0 items-center justify-center">
        <Icon name={icon} size={20} color={color} />
      </View>
    </View>
  );

  if (disabled) {
    if (rule === "self_destruct") {
      return <View className="p-3">{ruleContent}</View>;
    }
    return (
      <View className="p-3">
        <View className="w-6 h-6 items-center justify-center" testID="rules-icon-box">
          <Icon name="pipe" size={20} color={colors.muted} testID="rules-icon-placeholder" />
        </View>
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity
        className="p-3"
        accessibilityRole="button"
        accessibilityLabel="Pipe rule settings"
        onPress={() => setModalVisible(true)}
      >
        {ruleContent}
      </TouchableOpacity>
      {modalVisible ? (
        <RuleModal visible onClose={() => setModalVisible(false)} pipeId={pipeId} />
      ) : null}
    </>
  );
}
