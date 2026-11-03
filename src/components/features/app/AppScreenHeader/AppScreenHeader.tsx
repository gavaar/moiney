import { View } from "react-native";
import {
  ScreenHeader,
  type ScreenHeaderProps,
} from "@ui/ScreenHeader/ScreenHeader";
import { MoineyVers } from "./MoineyVers";
import { useOpenPipes } from "../PipesNavigationProvider/PipesNavigationProvider";

export type AppScreenHeaderProps = Pick<ScreenHeaderProps, "title" | "left" | "right">;

export function AppScreenHeader({
  title,
  left = <MoineyVers />,
  right,
}: AppScreenHeaderProps) {
  const openPipes = useOpenPipes();
  return (
    <View className="px-4">
      <ScreenHeader
        title={title}
        left={left}
        right={right}
        titleAction={{ onPress: openPipes, label: `${title}, Pipes shortcut` }}
      />
    </View>
  );
}
