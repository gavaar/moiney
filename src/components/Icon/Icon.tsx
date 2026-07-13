import { colors } from "@/lib/styles";
import { Ionicons } from "@expo/vector-icons";
import { type TextStyle } from "react-native";

type IconName = "eye" | "eye-off" | "arrow-left" | "check" | "check-circle" | "x" | "x-circle" | "log-out";

const ICON_MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  eye: "eye",
  "eye-off": "eye-off",
  "arrow-left": "arrow-back",
  check: "checkmark",
  "check-circle": "checkmark-circle",
  x: "close",
  "x-circle": "close-circle",
  "log-out": "log-out",
};

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export function Icon({ name, size = 20, color = colors.text, style }: Props) {
  return <Ionicons name={ICON_MAP[name]} size={size} color={color} style={style} />;
}