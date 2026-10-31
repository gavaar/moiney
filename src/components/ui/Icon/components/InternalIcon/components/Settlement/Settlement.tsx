import type { ColorValue } from "react-native";
import { Path } from "react-native-svg";

export function Settlement(paint: ColorValue) {
  return <>
    <Path d="M10.5 2.5C9 6 3.5 11 3.5 15.5a7 7 0 0 0 14 0c0-4.5-5.5-9.5-7-13Z"
      fill="none" stroke={paint} strokeWidth={1.8} strokeLinejoin="round" />
    <Path d="m19.25 2.25.9 2.35 2.35.9-2.35.9-.9 2.35-.9-2.35L16 5.5l2.35-.9Z" />
  </>;
}
