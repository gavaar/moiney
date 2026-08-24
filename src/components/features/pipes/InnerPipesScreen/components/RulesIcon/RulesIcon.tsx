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
import { RULE_OPTIONS, type RuleId } from "./RuleModal/config";

type Props = {
  pipeId: Id<"pipes">;
  rule?: RuleId;
  fed: number;
  capacity: number;
  spent?: number;
  cronNextDate?: number;
  cronInterval?: { interval: number; unit: CronUnit };
  disabled?: boolean;
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
}: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  const color = fed >= capacity ? colors.secondary : colors.text;
  const ruleIcon =
    rule != null ? RULE_OPTIONS.find((o) => o.id === rule)?.icon : undefined;
  const icon =
    ruleIcon ?? (fed >= capacity ? "lock-closed-outline" : "lock-open-outline");

  const ringProgress =
    rule === "spend_overflow" && capacity > 0
      ? Math.min(1, Math.max(0, (spent ?? 0) / capacity))
      : rule === "cron" && cronNextDate != null && cronInterval
        ? computeCronIntervalProgress(
            cronNextDate,
            cronInterval.interval,
            cronInterval.unit,
            Date.now(),
          )
        : undefined;

  if (disabled) {
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
      </TouchableOpacity>
      {modalVisible ? (
        <RuleModal visible onClose={() => setModalVisible(false)} pipeId={pipeId} />
      ) : null}
    </>
  );
}
