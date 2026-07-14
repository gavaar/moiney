import { vi } from "vitest";
import React from "react";

vi.mock("@expo/vector-icons", () => {
  const MockIcon = ({ testID, ...props }: any) =>
    React.createElement("span", { "data-testid": testID || "mock-icon", ...props });
  return {
    Ionicons: MockIcon,
    MaterialCommunityIcons: MockIcon,
  };
});
