import { TouchableOpacity, View } from "react-native";
import { useState } from "react";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { type Id } from "@convex/_generated/dataModel";
import { RuleModal } from "./RuleModal";
import { RULE_OPTIONS } from "./RuleModal/config";

type Props = {
  pipeId: Id<"pipes">;
  rule?: "spend_overflow" | "any_spend" | "cron";
  fed: number;
  capacity: number;
  disabled?: boolean;
};

export function RulesIcon({ pipeId, rule, fed, capacity, disabled }: Props) {
  const [modalVisible, setModalVisible] = useState(false);

  const color = fed >= capacity ? colors.secondary : colors.text;
  const ruleIcon =
    rule != null ? RULE_OPTIONS.find((o) => o.id === rule)?.icon : undefined;
  const icon =
    ruleIcon ?? (fed >= capacity ? "lock-closed-outline" : "lock-open-outline");

  if (disabled) {
    return (
      <View className="p-3">
        <Icon name="pipe" size={20} color={colors.surface} testID="rules-icon-placeholder" />
      </View>
    );
  }

  return (
    <>
      <TouchableOpacity className="p-3" onPress={() => setModalVisible(true)}>
        <Icon name={icon} size={20} color={color} />
      </TouchableOpacity>
      {modalVisible ? (
        <RuleModal visible onClose={() => setModalVisible(false)} pipeId={pipeId} />
      ) : null}
    </>
  );
}
