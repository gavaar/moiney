import { View } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { colors } from "@/lib/styles";

export function spentBg(spent: number, fed: number): string {
  const r = fed === 0 ? (spent > 0 ? 2 : 0) : Math.min(spent / fed, 2);

  if (r <= 1) {
    const t = r;
    return `rgb(${Math.round(70 * (1 - t))}, ${Math.round(174 * (1 - t))}, ${Math.round(130 * (1 - t))})`;
  } else {
    const t = r - 1;
    return `rgb(${Math.round(192 * t)}, ${Math.round(89 * t)}, ${Math.round(89 * t)})`;
  }
}

type MiniChildBoxProps = {
  icon: string;
  fed: number;
  spent: number;
};

export function MiniChildBox({ icon, fed, spent }: MiniChildBoxProps) {
  return (
    <View
      className="flex-1 rounded-lg items-center justify-center p-0.5"
      style={{ backgroundColor: spentBg(spent, fed), borderWidth: 1, borderColor: colors.surface }}
    >
      <Icon name={icon as IconName} size={12} color={colors.text} />
    </View>
  );
}
