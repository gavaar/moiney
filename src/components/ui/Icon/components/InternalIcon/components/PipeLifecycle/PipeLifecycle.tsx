import type { ColorValue } from "react-native";
import { Path, Rect } from "react-native-svg";

export function PipeLifecycle(paint: ColorValue, change: "creation" | "deletion") {
  return <>
    {/* Instant-pipe silhouette without its arrow; the sign sits below the flanges. */}
    <Rect x={1} y={3} width={3.7} height={10.8} rx={1.35} />
    <Rect x={19} y={3} width={3.7} height={10.8} rx={1.35} />
    <Rect x={5.2} y={4.6} width={13.3} height={7.6} />
    <Path d={change === "creation" ? "M15.5 19H22M18.75 15.75V22.25" : "M15.5 19H22"}
      fill="none" stroke={paint} strokeWidth={2} strokeLinecap="round" />
  </>;
}
