import { Circle, Svg } from "react-native-svg";

type Props = {
  size?: number;
  strokeWidth?: number;
  progress: number;
  color: string;
  trackColor?: string;
};

export function ProgressRing({
  size = 32,
  strokeWidth = 3,
  progress,
  color,
  trackColor,
}: Props) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, progress));
  const dashOffset = circumference * (1 - clamped);
  const transform = `translate(${size} 0) scale(-1 1) rotate(-90 ${size / 2} ${size / 2})`;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {trackColor ? (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
      ) : null}
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        transform={transform}
      />
    </Svg>
  );
}
