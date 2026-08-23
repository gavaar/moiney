import { Slot } from "expo-router";
import { PipesProviders } from "@features/pipes/PipesProviders";

export default function PipesLayout() {
  return (
    <PipesProviders>
      <Slot />
    </PipesProviders>
  );
}
