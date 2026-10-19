import type { ReactNode } from "react";
import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { cn } from "@/lib/styles";

export type InputAction = {
  content: ReactNode;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
};

export type InputActions = {
  prefix?: InputAction | null;
  suffix?: InputAction | null;
};

type Props = InputActions & {
  borderStyle: string;
  appearance?: "outlined" | "borderless";
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
} & (
  | (ViewProps & { onPress?: never })
  | (Omit<PressableProps, "className" | "children"> & { onPress: NonNullable<PressableProps["onPress"]>; children?: ReactNode })
);

export function InputWrapper({ borderStyle, appearance = "outlined", className, contentClassName, disabled, prefix, suffix, ...props }: Props) {
  const contentStyle = cn("min-w-0 flex-1 px-3 py-2", contentClassName);

  function renderAction(action: InputAction | null | undefined, side: "prefix" | "suffix") {
    if (!action) return null;
    const actionDisabled = !!(disabled || action.disabled);
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={action.accessibilityLabel}
        accessibilityState={{ disabled: actionDisabled }}
        disabled={actionDisabled}
        onPress={() => { if (!actionDisabled) action.onPress(); }}
        className={cn(
          "min-w-[32px] self-stretch items-center justify-center px-2",
          appearance === "outlined" && (side === "prefix" ? "border-r" : "border-l"),
          borderStyle,
          actionDisabled && "opacity-40",
        )}
      >
        {action.content}
      </Pressable>
    );
  }

  return (
    <View className={cn(
      "flex-row",
      appearance === "borderless" ? "bg-transparent" : "overflow-hidden rounded-lg border bg-surface",
      borderStyle,
      className,
    )}>
      {renderAction(prefix, "prefix")}
      {props.onPress
        ? <Pressable {...props} disabled={disabled} className={contentStyle} />
        : <View {...props} className={contentStyle} />}
      {renderAction(suffix, "suffix")}
    </View>
  );
}
