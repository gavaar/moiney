import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { FormPage, type FormPageDefinition } from "./FormPage";
import { useFormPagerController } from "./useFormPagerController";

type Props = {
  pages: readonly FormPageDefinition[];
  warnings?: ReactNode;
  actions?: ReactNode;
  activeStep?: number;
  onStepChange?: (step: number) => void;
  fill?: boolean;
};

export function FormPager({ pages, warnings, actions, activeStep, onStepChange, fill = false }: Props) {
  const pager = useFormPagerController({ pageKeys: pages.map(page => page.key), activeStep, onStepChange, fill });
  const content = pages.map((page, index) => (
    <FormPage key={page.key} page={page} active={index === pager.activeIndex}
      width={pager.width} multiple={pager.multiple} fill={fill} onMeasure={pager.measurePage} />
  ));

  if (!pager.multiple) return <View className="gap-2" style={fill ? { flex: 1 } : { flexShrink: 1 }}>
    {content}
    {pages.length === 1 ? warnings : null}
    {pages.length === 1 ? actions : null}
  </View>;

  return (
    <View className="gap-2" style={fill ? { flex: 1 } : { flexShrink: 1 }}>
      <View className="flex-row" style={fill ? { flex: 1 } : { flexShrink: 1 }}>
        <View className="w-7">
          {pager.activeIndex > 0 ? <Pressable accessibilityRole="button" accessibilityLabel="Previous step"
            className="flex-1 items-center justify-center" onPress={() => pager.navigateToPage(pager.activeIndex - 1)}>
            <Icon name="chevron-back" size={18} color={colors.muted} />
          </Pressable> : null}
        </View>
        <View style={fill ? { flex: 1 } : { flexGrow: 1, flexShrink: 1 }}>
          <ScrollView
            {...pager.scrollProps}
            testID="form-pager"
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            style={{ flexGrow: fill ? 1 : 0, flexShrink: 1, height: pager.height }}
            contentContainerStyle={{ alignItems: fill ? "stretch" : "flex-start" }}
            {...(Platform.OS === "web" ? { onWheel: pager.beginUserScroll } : {})}
          >
            {content}
          </ScrollView>
        </View>
        <View className="w-7">
          {pager.activeIndex < pages.length - 1 ? <Pressable accessibilityRole="button" accessibilityLabel="Next step"
            className="flex-1 items-center justify-center" onPress={() => pager.navigateToPage(pager.activeIndex + 1)}>
            <Icon name="chevron-forward" size={18} color={colors.muted} />
          </Pressable> : null}
        </View>
      </View>
      {warnings}
      {actions}
      <View className="flex-row justify-center gap-2">
        {pages.map((page, index) => {
          const selected = index === pager.activeIndex;
          const backgroundColor = page.hasError
            ? selected ? colors.error : colors.errorDark
            : selected ? colors.text : colors.muted;
          return (
            <View key={page.key} accessible accessibilityRole="image"
              accessibilityLabel={`Step ${index + 1} of ${pages.length}${page.hasError ? ", has errors" : ""}`}
              accessibilityState={{ selected }} aria-selected={selected}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor }} />
          );
        })}
      </View>
    </View>
  );
}
