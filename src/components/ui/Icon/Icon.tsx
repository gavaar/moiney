import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { type ComponentType } from "react";
import { type TextStyle } from "react-native";
import { colors } from "@/lib/styles";
import { ICON_REGISTRY, type IconFamily, type IconName } from "./icons";

const FAMILY_COMPONENTS: Record<IconFamily, ComponentType<any>> = {
  Ionicons,
  MaterialCommunityIcons,
};

type Props = {
  name: IconName;
  size?: number;
  color?: string;
  style?: TextStyle;
};

export function Icon({ name, size = 20, color = colors.text, style }: Props) {
  const family = ICON_REGISTRY[name];
  const Component = FAMILY_COMPONENTS[family];
  return <Component name={name} size={size} color={color} style={style} />;
}
