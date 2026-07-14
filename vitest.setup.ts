import { vi } from "vitest";
import React from "react";

process.env.EXPO_PUBLIC_CONVEX_URL = "https://test.convex.cloud";

vi.mock("@expo/vector-icons", () => {
  const MockIcon = ({ testID, ...props }: any) =>
    React.createElement("span", { "data-testid": testID || "mock-icon", ...props });
  return {
    Ionicons: MockIcon,
    MaterialCommunityIcons: MockIcon,
  };
});
