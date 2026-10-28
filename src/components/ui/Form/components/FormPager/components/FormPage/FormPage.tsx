import type { ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { OptionListScope } from "@ui/OptionList";

export type FormPageDefinition = {
  key: number;
  content: ReactNode;
  hasError: boolean;
  hasWarning?: boolean;
  scrollable?: boolean;
};

type Props = {
  page: FormPageDefinition;
  active: boolean;
  width: number;
  multiple: boolean;
  onMeasure: (key: number, height: number) => void;
};

/** Keeps inactive inputs mounted, but removes them from interaction/accessibility. */
export function FormPage({ page, active, width, multiple, onMeasure }: Props) {
  const accessibility = {
    "aria-hidden": !active,
    accessibilityElementsHidden: !active,
    importantForAccessibility: active ? "auto" as const : "no-hide-descendants" as const,
    pointerEvents: active ? "auto" as const : "none" as const,
    ...(Platform.OS === "web" ? { inert: !active } : {}),
  };
  const style = {
    width: multiple ? width || "100%" as const : undefined,
    flexGrow: 0,
    flexShrink: multiple ? 0 : 1,
    // ScrollViews report full content height within a bounded viewport. Inline
    // lists own vertical scrolling and report their naturally bounded layout.
    maxHeight: multiple && page.scrollable !== false ? "100%" as const : undefined,
  };

  return page.scrollable === false ? (
    <View {...accessibility} style={[style, { gap: 4, padding: 4 }]}
      onLayout={event => onMeasure(page.key, event.nativeEvent.layout.height)}>
      <OptionListScope active={active}>{page.content}</OptionListScope>
    </View>
  ) : (
    <ScrollView {...accessibility} style={style}
      onContentSizeChange={(_width, height) => onMeasure(page.key, height)}
      contentContainerStyle={{ gap: 4, padding: 4 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
      <OptionListScope active={active}>{page.content}</OptionListScope>
    </ScrollView>
  );
}
