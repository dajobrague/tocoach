import { heroui } from "@heroui/theme";

/** @type {import('tailwindcss').Config} */
const config = {
  content: [
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./node_modules/@heroui/theme/dist/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        mono: ["var(--font-mono)"],
        heading: ["var(--font-heading)"],
        body: ["var(--font-body)"],
      },
      colors: {
        brand: "var(--color-brand)",
        accent: "var(--color-accent)",
        "text-primary": "var(--color-text-primary)",
        "text-secondary": "var(--color-text-secondary)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        "theme-border": "var(--color-border)",
        "theme-fill": "var(--color-fill)",
        focus: "var(--color-focus)",
      },
      borderRadius: {
        "theme-sm": "var(--radius-sm)",
        "theme-md": "var(--radius-md)",
        "theme-lg": "var(--radius-lg)",
        "theme-xl": "var(--radius-xl)",
      },
      boxShadow: {
        "e1": "var(--shadow-e1)",
        "e2": "var(--shadow-e2)",
      },
    },
  },
  darkMode: "class",
  plugins: [
    heroui({
      themes: {
        light: {
          colors: {
            primary: {
              50: "#e0f2fe",
              100: "#bae6fd",
              200: "#7dd3fc",
              300: "#38bdf8",
              400: "#0ea5e9",
              500: "#0284c7",
              600: "#0369a1",
              700: "#075985",
              800: "#0c4a6e",
              900: "#082f49",
              DEFAULT: "#0ea5e9",
              foreground: "#ffffff",
            },
            success: {
              DEFAULT: "#22c55e",
              foreground: "#ffffff",
            },
            warning: {
              DEFAULT: "#f59e0b",
              foreground: "#ffffff",
            },
            danger: {
              DEFAULT: "#ef4444",
              foreground: "#ffffff",
            },
            secondary: {
              DEFAULT: "#a855f7",
              foreground: "#ffffff",
            },
          },
        },
      },
    }),
  ],
};

module.exports = config;
