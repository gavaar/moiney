import { defineConfig } from "vitest/config";
import projectConfig from "../vitest.config";

export default defineConfig({
  ...projectConfig,
  test: {
    ...projectConfig.test,
    include: ["benchmarks/history-expansion-render.test.tsx"],
    maxWorkers: 1,
    testTimeout: 120_000,
  },
});
