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
  testID?: string;
};

export function Icon({ name, size = 20, color = colors.text, style, testID }: Props) {
  const family = ICON_REGISTRY[name];
  const Component = FAMILY_COMPONENTS[family];
  return <Component testID={testID} name={name} size={size} color={color} style={style} />;
}
