const { defineConfig, globalIgnores } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  globalIgnores(["convex/_generated/**", "dist/**"]),
  expoConfig,
  {
    // Keep existing React/compiler debt visible without blocking adoption.
    rules: {
      "react/no-children-prop": "warn",
      "react/no-unescaped-entities": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/rules-of-hooks": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    files: ["domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            "react",
            "react/*",
            "react-native",
            "react-native/*",
            "convex",
            "convex/*",
            "@/*",
            "@convex/*",
            "@features/*",
            "@ui/*",
          ],
        },
      ],
    },
  },
  {
    files: ["src/components/ui/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: ["@convex/*", "@features/*"],
        },
      ],
    },
  },
]);
