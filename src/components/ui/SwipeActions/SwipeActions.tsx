import { useState, type ReactNode } from "react";
import { Animated, PanResponder, Pressable, View } from "react-native";
import { colors } from "@/lib/styles";

type SwipeAction = {
  accessibilityLabel: string;
  content: ReactNode;
  backgroundClassName: string;
  onActivate: () => void;
  disabled?: boolean;
};

type Props = {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
};

// Keep the underlay wider than the reveal to cover rounded row corners.
const UNDERLAY_WIDTH = 92;
const REVEAL_WIDTH = 72;
const ACTIVATION_THRESHOLD = 40;

export function SwipeActions({ children, leftAction, rightAction }: Props) {
  const [translateX] = useState(() => new Animated.Value(0));
  const canSwipeRight = !!leftAction && !leftAction.disabled;
  const canSwipeLeft = !!rightAction && !rightAction.disabled;

  function resetSwipe() {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
    }).start();
  }

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) =>
      Math.abs(gesture.dx) > Math.abs(gesture.dy) &&
      ((canSwipeRight && gesture.dx > 8) || (canSwipeLeft && gesture.dx < -8)),
    onPanResponderMove: (_event, gesture) => {
      translateX.setValue(Math.max(
        canSwipeLeft ? -REVEAL_WIDTH : 0,
        Math.min(canSwipeRight ? REVEAL_WIDTH : 0, gesture.dx),
      ));
    },
    onPanResponderRelease: (_event, gesture) => {
      if (canSwipeRight && gesture.dx >= ACTIVATION_THRESHOLD) {
        leftAction?.onActivate();
      } else if (canSwipeLeft && gesture.dx <= -ACTIVATION_THRESHOLD) {
        rightAction?.onActivate();
      }
      resetSwipe();
    },
    onPanResponderTerminate: resetSwipe,
  });

  return (
    <View className="relative flex-1 rounded-2xl">
      {leftAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={leftAction.accessibilityLabel}
          accessibilityState={{ disabled: !!leftAction.disabled }}
          disabled={leftAction.disabled}
          onPress={leftAction.onActivate}
          style={{ width: UNDERLAY_WIDTH }}
          className={`absolute inset-y-0 left-0 rounded-tl-2xl rounded-bl-2xl items-center justify-center ${leftAction.backgroundClassName}`}
        >
          {leftAction.content}
        </Pressable>
      ) : null}
      {rightAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={rightAction.accessibilityLabel}
          accessibilityState={{ disabled: !!rightAction.disabled }}
          disabled={rightAction.disabled}
          onPress={rightAction.onActivate}
          style={{ width: UNDERLAY_WIDTH }}
          className={`absolute inset-y-0 right-0 rounded-tr-2xl rounded-br-2xl items-center justify-center ${rightAction.backgroundClassName}`}
        >
          {rightAction.content}
        </Pressable>
      ) : null}
      <Animated.View
        style={{
          width: "100%",
          zIndex: 1,
          backgroundColor: colors.background,
          transform: [{ translateX }],
          borderRadius: 12,
        }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}
