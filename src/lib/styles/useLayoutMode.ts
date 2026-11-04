import { useWindowDimensions } from "react-native";
import { expandedWidth } from "./layout";

export function useLayoutMode() {
  return useWindowDimensions().width >= expandedWidth ? "expanded" : "compact";
}
