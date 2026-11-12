import type { ReactNode } from "react";
import { Text, View, type ColorValue } from "react-native";
import { cn, colors } from "@/lib/styles";
import { Icon, safeIconName } from "@ui/Icon";
import type { TreeItemState } from "@ui/TreeList";

type Props = {
  pipe: { name: string; icon: string };
  state?: TreeItemState;
  iconColor?: ColorValue;
  summary?: string;
  children?: ReactNode;
};

export function PipeTreeItem({ pipe, state, iconColor, summary, children }: Props) {
  return <View className="flex-row items-center gap-2">
    <Icon name={safeIconName(pipe.icon)} size={16} color={state?.muted ? colors.muted : iconColor ?? colors.muted} />
    <Text className={cn("flex-1 shrink text-base", state?.root && "font-semibold",
      state?.muted ? "text-muted" : state?.selected && state.multiple ? "text-primary" : "text-text")} numberOfLines={1}>
      {pipe.name}{state?.muted ? "" : summary}
    </Text>
    {children}
  </View>;
}
