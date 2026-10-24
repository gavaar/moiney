import { Ionicons, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { type ColorValue, type TextStyle } from "react-native";
import { colors } from "@/lib/styles";
import { getIcon, type IconName } from "./icons";

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  style?: TextStyle;
  testID?: string;
};

export function Icon({ name, size = 20, color = colors.text, style, testID }: Props) {
  const icon = getIcon(name);
  // Expo forwards color to native Text, but its types omit RN's numeric/null forms.
  const props = { testID, size, color: color as ComponentProps<typeof Ionicons>["color"], style };
  switch (icon.family) {
    case "Ionicons":
      return <Ionicons {...props} name={icon.name} />;
    case "MaterialCommunityIcons":
      return <MaterialCommunityIcons {...props} name={icon.name} />;
    case "MaterialIcons":
      return <MaterialIcons {...props} name={icon.name} />;
  }
}
