import { Platform, Pressable, View, type ViewProps } from "react-native";

type Props = Pick<ViewProps, "className" | "style" | "testID"> & { onPress: () => void };

/** Escape/Back owns keyboard dismissal; the backdrop is only a pointer target. */
export function PointerBackdrop({ onPress, ...props }: Props) {
  if (Platform.OS === "web") return <View {...props} {...{ onClick: onPress }} />;
  return <Pressable {...props} onPress={onPress} accessible={false} focusable={false} />;
}
