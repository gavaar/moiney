import { View } from "react-native";
import { Icon, type IconName } from "@ui/Icon";
import { colors } from "@/lib/styles";

export function spentBg(spent: number, fed: number): string {
  const effectiveSpent = Math.max(spent, 0);

  // Hardcoded RGB tuples (not colors.primary / colors.error) because this
  // function interpolates between them numerically.  Primary: rgb(70, 174, 130),
  // error: rgb(192, 89, 89).  Parsing hex from the colors object just to
  // destructure back into numbers adds complexity for zero gain.
  if (fed <= 0) {
    return effectiveSpent > 0 ? `rgb(192, 89, 89)` : `rgb(70, 174, 130)`;
  }

  const r = effectiveSpent === 0 ? 0 : Math.min(effectiveSpent / fed, 2);

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
      <Icon name={icon as IconName} size={12} color={isDebt ? colors.error : colors.text} />
    </View>
  );
}
