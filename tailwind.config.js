const colors = require("./src/lib/styles/colors");

// Resolve at build time so browser CSS gets plain units, not native runtime functions.
const isWeb = process.env.NATIVEWIND_OS === undefined || process.env.NATIVEWIND_OS === "web";

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/lib/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class",
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      screens: {
        expanded: "1024px",
      },
      maxWidth: {
        // Match web's default 16px rem deliberately, not NativeWind's native rem.
        "screen-content": isWeb ? "64rem" : "1024px",
        "auth-content": isWeb ? "28rem" : "448px",
      },
    },
  },
  plugins: [],
};
