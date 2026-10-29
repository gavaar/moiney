import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";

type Props = {
  messages?: readonly string[];
  dismissible?: boolean;
};

export function FormWarning({ messages, dismissible = true }: Props) {
  const [dismissedWarnings, setDismissedWarnings] = useState<ReadonlySet<string>>(() => new Set());
  const visibleWarnings = [...new Set(messages)].filter(message => !dismissible || !dismissedWarnings.has(message));
  if (!visibleWarnings.length) return null;

  return <View className="gap-1">
    {visibleWarnings.map(message => <View key={message} accessibilityRole="alert"
      className={`relative min-h-11 rounded-xl border border-warning/30 bg-warning/10 pl-3 py-2 ${dismissible ? "pr-12" : "pr-3"}`}>
      <Text className="text-warning text-sm">{message}</Text>
      {dismissible ? <Pressable accessibilityRole="button" accessibilityLabel="Dismiss warning"
        className="absolute top-2 right-2 items-center justify-center active:opacity-70"
        onPress={() => setDismissedWarnings(previous => new Set([...previous, message]))}>
        <Icon name="close" size={12} color={colors.muted} />
      </Pressable> : null}
    </View>)}
  </View>;
}
