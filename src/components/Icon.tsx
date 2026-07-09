import { Ionicons } from "@expo/vector-icons";
import { type TextStyle } from "react-native";

type IconName = "eye" | "eye-off" | "arrow-left" | "check" | "x" | "log-out";

const ICON_MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  eye: "eye",
  "eye-off": "eye-off",
  "arrow-left": "arrow-back",
  check: "checkmark",
  x: "close",
  "log-out": "log-out",
};

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export function Icon({ name, size = 20, color = "#111827", style }: Props) {
  return <Ionicons name={ICON_MAP[name]} size={size} color={color} style={style} />;
}