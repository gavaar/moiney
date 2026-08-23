import { View } from "react-native";
import {
  ScreenHeader,
  type ScreenHeaderProps,
} from "@ui/ScreenHeader/ScreenHeader";
import { MoineyVers } from "./MoineyVers";

export type AppScreenHeaderProps = Pick<ScreenHeaderProps, "title" | "right">;

export function AppScreenHeader({
  title,
  right,
}: AppScreenHeaderProps) {
  return (
    <View className="px-4">
      <ScreenHeader title={title} left={<MoineyVers />} right={right} />
    </View>
  );
}
