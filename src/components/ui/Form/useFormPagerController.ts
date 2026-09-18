import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Keyboard, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollView } from "react-native";

type Props = {
  pageKeys: readonly number[];
  activeStep?: number;
  onStepChange?: (step: number) => void;
  fill: boolean;
};

type PageMeasurement = { width: number; height: number };

/** Owns step keys, measured page geometry, and synchronization with native offsets. */
export function useFormPagerController({ pageKeys, activeStep, onStepChange, fill }: Props) {
  const [selectedKey, setSelectedKey] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [measurements, setMeasurements] = useState<Record<number, PageMeasurement>>({});
  const activeIndex = Math.max(0, pageKeys.findIndex(key => key === (activeStep ?? selectedKey)));
  const multiple = pageKeys.length > 1;
  const pageSignature = pageKeys.join(",");
  const activeMeasurement = measurements[pageKeys[activeIndex]];
  const height = !fill && activeMeasurement?.width === width ? activeMeasurement.height : undefined;

  const scrollRef = useRef<ScrollView>(null);
  const alignmentTarget = useRef<number | null>(null);
  const contentWidth = useRef(0);

  function measurePage(key: number, height: number) {
    if (!multiple || fill || width <= 0) return;
    setMeasurements(previous => previous[key]?.height === height && previous[key]?.width === width
      ? previous : { ...previous, [key]: { width, height } });
  }

  function alignToSelectedPage() {
    if (width <= 0) return;
    // Native may clamp scrollTo to zero until content layout completes. Ignore
    // those intermediate events; they must not replace the requested step.
    const x = activeIndex * width;
    alignmentTarget.current = x;
    scrollRef.current?.scrollTo({ x, animated: false });
  }

  const alignLatestPage = useEffectEvent(alignToSelectedPage);
  useEffect(() => {
    alignLatestPage();
  }, [width, pageSignature, activeStep]);

  function selectPage(index: number) {
    const key = pageKeys[index];
    if (key === undefined) return;
    if (activeStep === undefined) setSelectedKey(key);
    if (key !== (activeStep ?? selectedKey)) onStepChange?.(key);
  }

  function navigateToPage(index: number) {
    const nextIndex = Math.max(0, Math.min(pageKeys.length - 1, index));
    Keyboard.dismiss();
    selectPage(nextIndex);
    if (activeStep === undefined) scrollRef.current?.scrollTo({ x: nextIndex * width, animated: true });
  }

  function handleViewportLayout(event: LayoutChangeEvent) {
    setWidth(event.nativeEvent.layout.width);
  }

  function handleContentSizeChange(nextWidth: number) {
    if (contentWidth.current === nextWidth) return;
    contentWidth.current = nextWidth;
    alignToSelectedPage();
  }

  function beginUserScroll() {
    alignmentTarget.current = null;
  }

  function handleScrollBeginDrag() {
    beginUserScroll();
    Keyboard.dismiss();
  }

  function handleScroll({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const viewportWidth = nativeEvent.layoutMeasurement.width;
    if (viewportWidth <= 0) return;
    const offset = nativeEvent.contentOffset.x;
    if (alignmentTarget.current !== null) {
      if (Math.abs(offset - alignmentTarget.current) < 1) alignmentTarget.current = null;
      return;
    }
    selectPage(Math.max(0, Math.min(pageKeys.length - 1, Math.round(offset / viewportWidth))));
  }

  return {
    activeIndex, multiple, width, height, measurePage, navigateToPage, beginUserScroll,
    scrollProps: {
      ref: scrollRef,
      onLayout: handleViewportLayout,
      onContentSizeChange: handleContentSizeChange,
      onScroll: handleScroll,
      onScrollBeginDrag: handleScrollBeginDrag,
      onTouchStart: beginUserScroll,
    },
  };
}
