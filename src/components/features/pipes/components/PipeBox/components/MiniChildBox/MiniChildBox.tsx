import { View } from "react-native";
import { Icon, safeIconName } from "@ui/Icon";
import { colors } from "@/lib/styles";

export function spentBg(spent: number, fed: number): string {
  const effectiveSpent = Math.max(spent, 0);
  const ratio = fed > 0 ? Math.min(effectiveSpent / fed, 2) : effectiveSpent > 0 ? 2 : 0;
  // Preserve the black midpoint at fully spent, deriving both ends from the theme.
  const token = ratio <= 1 ? colors.primary : colors.error;
  const intensity = ratio <= 1 ? 1 - ratio : ratio - 1;
  const channels = [1, 3, 5].map(start => Math.round(parseInt(token.slice(start, start + 2), 16) * intensity));
  return `rgb(${channels.join(", ")})`;
}

type MiniChildBoxProps = {
  icon: string;
  fed: number;
  spent: number;
};

export function MiniChildBox({ icon, fed, spent }: MiniChildBoxProps) {
  const isDebt = fed < 0;

  return (
    <View
      className={`flex-1 rounded-lg items-center justify-center p-0.5 ${isDebt ? "bg-surface" : ""}`}
      style={{
        backgroundColor: isDebt ? colors.surface : spentBg(spent, fed),
        borderWidth: 1,
        borderColor: isDebt ? colors.errorDark : colors.surface,
      }}
    >
      <Icon name={safeIconName(icon)} size={12} color={isDebt ? colors.error : colors.text} />
    </View>
  );
}
