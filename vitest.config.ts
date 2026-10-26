import { defineConfig } from "vitest/config";
import path from "path";
import { transformWithOxc } from "vite";

export default defineConfig({
  plugins: [
    {
      name: "markdown-native-jsx",
      // This native dependency ships JSX in .js files; exercise its real renderer.
      async transform(code, id) {
        if (id.includes("/node_modules/react-native-markdown-display/") && id.endsWith(".js")) {
          return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
        }
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@convex": path.resolve(__dirname, "./convex"),
      "@ui": path.resolve(__dirname, "./src/components/ui"),
      "@features": path.resolve(__dirname, "./src/components/features"),
      "@domain": path.resolve(__dirname, "./domain"),
      "react-native": "react-native-web",
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: [
      "src/**/*.test.{ts,tsx}",
      "convex/**/*.test.{ts,tsx}",
      "domain/**/*.test.{ts,tsx}",
      "scripts/**/*.test.ts",
    ],
    setupFiles: ["./vitest.setup.ts"],
  },
});
