import { vi } from "vitest";
import React from "react";

process.env.EXPO_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

// DOM tests have no native safe-area measurements; device layout is verified separately.
vi.mock("react-native-safe-area-context", async () => {
  const { View } = await import("react-native");
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) => children,
    SafeAreaView: View,
  };
});

vi.mock("@expo/vector-icons", () => {
  const MockIcon = ({ testID, ...props }: any) =>
    React.createElement("span", { "data-testid": testID || "mock-icon", ...props });
  return {
    Ionicons: MockIcon,
    MaterialCommunityIcons: MockIcon,
    MaterialIcons: MockIcon,
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
