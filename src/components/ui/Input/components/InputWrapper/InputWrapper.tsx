import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { cn } from "@/lib/styles";

type Props = {
  borderStyle: string;
  className?: string;
  joinedStart?: boolean;
} & (
  | (ViewProps & { onPress?: never })
  | (Omit<PressableProps, "className"> & { onPress: NonNullable<PressableProps["onPress"]> })
);

export function InputWrapper({ borderStyle, className, joinedStart, ...props }: Props) {
  const surfaceClassName = cn(
    "border bg-surface px-3 py-2",
    joinedStart ? "rounded-tr-lg rounded-br-lg" : "rounded-lg",
    borderStyle,
    className,
  );

  if (props.onPress) {
    return <Pressable {...props} className={surfaceClassName} />;
  }

  return <View {...props} className={surfaceClassName} />;
}
