import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        police: {
          50: "#eef4ff",
          100: "#d9e6ff",
          200: "#bad0ff",
          300: "#8db0ff",
          400: "#5c89ff",
          500: "#3a66f5",
          600: "#284ed6",
          700: "#213faa",
          800: "#213a86",
          900: "#22356a",
          950: "#172145",
        },
        predict: {
          safe: "#0f766e",
          likely: "#1d4ed8",
          possible: "#d97706",
          challenge: "#dc2626",
        },
      },
    },
  },
};

export default config;
