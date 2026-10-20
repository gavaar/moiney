import type { ReactNode } from "react";
import { Platform, Pressable, ScrollView, View } from "react-native";
import { Icon } from "@ui/Icon";
import { colors } from "@/lib/styles";
import { FormPage, FormWarning, PagerIndicator, type FormPageDefinition } from "./components";
import { useFormPagerController } from "./useFormPagerController";

type Props = {
  pages: readonly FormPageDefinition[];
  warnings?: readonly string[];
  actions?: ReactNode;
  navigationStart?: number;
};

function PagerBackButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return <View className="w-7">
    <Pressable accessibilityRole="button" accessibilityLabel="Previous step"
      className="flex-1 items-center justify-center" onPress={onPress} disabled={disabled}>
      <Icon name="chevron-back" size={18} color={disabled ? colors.border : colors.muted} />
    </Pressable>
  </View>;
}

function PagerForwardButton({ disabled, onPress }: { disabled: boolean; onPress: () => void }) {
  return <View className="w-7">
    <Pressable accessibilityRole="button" accessibilityLabel="Next step"
      className="flex-1 items-center justify-center" onPress={onPress} disabled={disabled}>
      <Icon name="chevron-forward" size={18} color={disabled ? colors.border : colors.muted} />
    </Pressable>
  </View>;
}

export function FormPager({ pages, warnings, actions, navigationStart }: Props) {
  const pager = useFormPagerController({ pageKeys: pages.map(page => page.key), navigationStart });
  const content = pages.map((page, index) => (
    <FormPage key={page.key} page={page} active={index === pager.activeIndex}
      width={pager.width} multiple={pager.multiple} onMeasure={pager.measurePage} />
  ));

  if (!pager.multiple) return <View className="gap-2" style={{ flexShrink: 1 }}>
    {content}
    {pages.length === 1 ? actions : null}
    <FormWarning messages={pages.length === 1 ? warnings : undefined} />
  </View>;

  return (
    <View className="gap-2" style={{ flexShrink: 1 }}>
      <View className="flex-row" style={{ flexShrink: 1 }}>
        <PagerBackButton disabled={pager.activeIndex === 0} onPress={() => pager.navigateToPage(pager.activeIndex - 1)} />
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <ScrollView
            {...pager.scrollProps}
            testID="form-pager"
            horizontal
            pagingEnabled
            directionalLockEnabled
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEventThrottle={16}
            style={{ flexGrow: 0, flexShrink: 1, height: pager.height }}
            contentContainerStyle={{ alignItems: "flex-start" }}
            {...(Platform.OS === "web" ? { onWheel: pager.beginUserScroll } : {})}
          >
            {content}
          </ScrollView>
        </View>
        <PagerForwardButton disabled={pager.activeIndex === pages.length - 1} onPress={() => pager.navigateToPage(pager.activeIndex + 1)} />
      </View>
      {actions}

      <FormWarning messages={warnings} />
      <PagerIndicator pages={pages} activeIndex={pager.activeIndex} />
    </View>
  );
}
