import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
      "@ui": path.resolve(__dirname, "./src/components/ui"),
      "@features": path.resolve(__dirname, "./src/components/features"),
      "react-native": "react-native-web",
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}", "convex/**/*.test.{ts,tsx}"],
    setupFiles: ["./vitest.setup.ts"],
  },
});