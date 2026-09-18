import type { ReactNode } from "react";
import { Platform, ScrollView, View } from "react-native";
import { Button } from "@ui/Button";
import { colors } from "@/lib/styles";
import { FormPage, type FormPageDefinition } from "./FormPage";
import { useFormPagerController } from "./useFormPagerController";

type Props = {
  pages: readonly FormPageDefinition[];
  finalAction?: ReactNode;
  activeStep?: number;
  onStepChange?: (step: number) => void;
  fill?: boolean;
};

export function FormPager({ pages, finalAction, activeStep, onStepChange, fill = false }: Props) {
  const pager = useFormPagerController({ pageKeys: pages.map(page => page.key), activeStep, onStepChange, fill });
  const content = pages.map((page, index) => (
    <FormPage key={page.key} page={page} active={index === pager.activeIndex}
      width={pager.width} multiple={pager.multiple} fill={fill} onMeasure={pager.measurePage} />
  ));

  if (!pager.multiple) return <>{content}{pages.length === 1 ? finalAction : null}</>;

  return (
    <>
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
      <View className="flex-row justify-between gap-4">
        <Button title="Back" variant="muted" disabled={pager.activeIndex === 0} onPress={() => pager.navigateToPage(pager.activeIndex - 1)} />
        {pager.activeIndex === pages.length - 1 && finalAction ? finalAction : (
          <Button title="Next" disabled={pager.activeIndex === pages.length - 1} onPress={() => pager.navigateToPage(pager.activeIndex + 1)} />
        )}
      </View>
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
    </>
  );
}
