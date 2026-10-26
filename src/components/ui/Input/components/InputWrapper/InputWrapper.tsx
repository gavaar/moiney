import type { ReactNode } from "react";
import { Pressable, View, type PressableProps, type ViewProps } from "react-native";
import { cn } from "@/lib/styles";
import { INPUT_CONTENT_PADDING } from "../../input.config";
import type { InputAction, InputActions } from "../../input.types";

type Props = InputActions & {
  borderStyle: string;
  appearance?: "outlined" | "borderless";
  className?: string;
  contentClassName?: string;
  contentPadding?: boolean;
  disabled?: boolean;
} & (
  | (ViewProps & { onPress?: never })
  | (Omit<PressableProps, "className" | "children"> & { onPress: NonNullable<PressableProps["onPress"]>; children?: ReactNode })
);

export function InputWrapper({ borderStyle, appearance = "outlined", className, contentClassName, contentPadding = true, disabled, prefix, suffix, ...props }: Props) {
  const contentStyle = cn("min-w-0 flex-1", contentPadding && INPUT_CONTENT_PADDING, contentClassName);

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
          "min-w-4 self-stretch items-center justify-center px-2",
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
      appearance === "borderless" ? "bg-transparent" : "rounded-lg border bg-surface",
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
