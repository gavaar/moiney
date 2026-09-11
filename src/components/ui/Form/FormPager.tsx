import { useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { Keyboard, Platform, ScrollView, View } from "react-native";
import { Button } from "@ui/Button";
import { colors } from "@/lib/styles";

type Props = {
  pages: readonly { key: number; content: ReactNode; hasError: boolean }[];
  finalAction?: ReactNode;
};

export function FormPager({ pages, finalAction }: Props) {
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const pager = useRef<ScrollView>(null);
  const activeIndex = Math.max(0, pages.findIndex((page) => page.key === selectedKey));
  const multiple = pages.length > 1;
  const pageSignature = pages.map((page) => page.key).join(",");

  const alignPage = useEffectEvent(() => {
    pager.current?.scrollTo({ x: activeIndex * width, animated: false });
  });
  useEffect(() => {
    alignPage();
  }, [width, pageSignature]);

  function navigate(index: number) {
    const nextIndex = Math.max(0, Math.min(pages.length - 1, index));
    Keyboard.dismiss();
    setSelectedKey(pages[nextIndex].key);
    pager.current?.scrollTo({ x: nextIndex * width, animated: true });
  }

  const content = pages.map((page, index) => (
    <ScrollView
      key={page.key}
      style={{ width: multiple ? width || "100%" : undefined, flexGrow: 0 }}
      contentContainerStyle={{ gap: 16, paddingBottom: 4 }}
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      aria-hidden={index !== activeIndex}
      accessibilityElementsHidden={index !== activeIndex}
      importantForAccessibility={index === activeIndex ? "auto" : "no-hide-descendants"}
      pointerEvents={index === activeIndex ? "auto" : "none"}
      {...(Platform.OS === "web" ? { inert: index !== activeIndex } : {})}
    >
      {page.content}
    </ScrollView>
  ));

  if (!multiple) return <>{content}{pages.length === 1 ? finalAction : null}</>;

  return (
    <>
      <ScrollView
        ref={pager}
        testID="form-pager"
        horizontal
        pagingEnabled
        directionalLockEnabled
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        style={{ flexGrow: 0 }}
        onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => Keyboard.dismiss()}
        onScroll={({ nativeEvent }) => {
          const pageWidth = nativeEvent.layoutMeasurement.width;
          if (pageWidth <= 0) return;
          const index = Math.max(0, Math.min(pages.length - 1, Math.round(nativeEvent.contentOffset.x / pageWidth)));
          setSelectedKey(pages[index].key);
        }}
      >
        {content}
      </ScrollView>
      <View className="flex-row justify-between gap-4">
        <Button title="Back" variant="muted" disabled={activeIndex === 0} onPress={() => navigate(activeIndex - 1)} />
        {activeIndex === pages.length - 1 && finalAction ? finalAction : (
          <Button title="Next" disabled={activeIndex === pages.length - 1} onPress={() => navigate(activeIndex + 1)} />
        )}
      </View>
      <View className="flex-row justify-center gap-2">
        {pages.map((page, index) => {
          const selected = index === activeIndex;
          const backgroundColor = page.hasError
            ? selected ? colors.error : colors.errorDark
            : selected ? colors.text : colors.muted;
          return (
            <View
              key={page.key}
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Step ${index + 1} of ${pages.length}${page.hasError ? ", has errors" : ""}`}
              accessibilityState={{ selected }}
              aria-selected={selected}
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor }}
            />
          );
        })}
      </View>
    </>
  );
}
