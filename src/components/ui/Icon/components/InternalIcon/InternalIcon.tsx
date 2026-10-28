import type { ReactNode } from "react";
import type { ColorValue, TextStyle } from "react-native";
import Svg, { G } from "react-native-svg";
import { Boiler, BombPipe, FeedPipe, InstantPipe, OverflowPipe, Valve } from "./components";

type Artwork = {
  viewBox: string;
  render: (paint: ColorValue) => ReactNode;
};

const ARTWORK = {
  boiler: {
    viewBox: "349 147 556 998",
    render: Boiler,
  },
  "bomb-pipe": {
    viewBox: "314 187 684 918",
    render: BombPipe,
  },
  "feed-pipe": {
    viewBox: "244 432 746 475",
    render: FeedPipe,
  },
  "instant-pipe": {
    viewBox: "241 483 772 363",
    render: InstantPipe,
  },
  "overflow-pipe": {
    viewBox: "130 384 1040 558",
    render: OverflowPipe,
  },
  valve: {
    viewBox: "482 532 290 322",
    render: Valve,
  },
} satisfies Record<string, Artwork>;

export type InternalIconName = keyof typeof ARTWORK;

type Props = {
  name: InternalIconName;
  size: number;
  color: ColorValue;
  style?: TextStyle;
  testID?: string;
};

export function InternalIcon({ name, size, color, style, testID }: Props) {
  const artwork = ARTWORK[name];

  return (
    <Svg width={size} height={size} viewBox={artwork.viewBox} preserveAspectRatio="xMidYMid meet" style={style} testID={testID}>
      <G fill={color}>{artwork.render(color)}</G>
    </Svg>
  );
}
