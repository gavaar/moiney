import { Stack } from "expo-router";
import { PipesProviders } from "@features/pipes/PipesProviders";

export default function PipesLayout() {
  return (
    <PipesProviders>
      <Stack screenOptions={{ headerShown: false }} />
    </PipesProviders>
  );
}
