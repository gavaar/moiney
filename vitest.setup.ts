import { vi } from "vitest";
import React from "react";
import { View as RNView } from "react-native";

process.env.EXPO_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

vi.mock("@expo/vector-icons", () => {
  const MockIcon = ({ testID, ...props }: any) =>
    React.createElement("span", { "data-testid": testID || "mock-icon", ...props });
  return {
    Ionicons: MockIcon,
    MaterialCommunityIcons: MockIcon,
  };
});

vi.mock("react-native-reanimated", () => {
  const animationBuilder = {
    duration: () => animationBuilder,
    delay: () => animationBuilder,
    springify: () => animationBuilder,
  };

  const AnimatedView = ({ children, entering, exiting, layout, ...rest }: any) =>
    React.createElement(RNView, rest, children);

  return {
    default: { View: AnimatedView },
    Animated: { View: AnimatedView },
    useSharedValue: (init: any) => ({ value: init }),
    useAnimatedStyle: (cb: () => any) => cb(),
    useDerivedValue: (cb: () => any) => ({ value: cb() }),
    withTiming: (toValue: any) => toValue,
    withSpring: (toValue: any) => toValue,
    interpolate: (value: any) => value,
    Easing: { ease: () => 0, inOut: () => 0, linear: () => 0 },
    LinearTransition: animationBuilder,
    FadeIn: animationBuilder,
    FadeOut: animationBuilder,
    FadeInDown: animationBuilder,
    FadeOutUp: animationBuilder,
  };
});

vi.mock("react-native-svg", () => {
  const Svg = ({ children, ...props }: any) =>
    React.createElement("div", { "data-testid": "svg", ...props }, children);
  const Circle = ({ children, ...props }: any) =>
    React.createElement("span", {
      "data-testid": "svg-circle",
      "data-props": JSON.stringify(props),
    });
  return { default: Svg, Svg, Circle };
});
