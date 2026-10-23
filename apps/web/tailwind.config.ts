import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#FAF8F4",
        surface: "#fdf9f5",
        "surface-container": "#f1ede9",
        "surface-container-low": "#f7f3ef",
        "surface-container-lowest": "#ffffff",
        "surface-container-high": "#ebe7e4",
        "surface-container-highest": "#e6e2de",
        "on-surface": "#1c1c19",
        "on-surface-variant": "#57534E",
        primary: {
          DEFAULT: "#06080a",
          container: "#1e2022",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#36684f",
          container: "#b9efcf",
          mint: "#4E8066",
          soft: "#E6F4EA",
          foreground: "#ffffff",
        },
        tertiary: {
          DEFAULT: "#1b0005",
          container: "#480018",
          rose: "#C95D73",
          roseSoft: "#FCECEF",
        },
        pastel: {
          peach: "#FFDDD2",
          peachSoft: "#FFF2EB",
          lilac: "#E8DEFF",
          lilacSoft: "#F5EFFF",
          mint: "#D8F3DC",
          mintSoft: "#EDFAF4",
        },
        outline: {
          DEFAULT: "#75777a",
          variant: "#c5c6ca",
          subtle: "rgba(28, 25, 23, 0.07)",
        },
      },
      borderRadius: {
        DEFAULT: "1rem",
        card: "24px",
        xl: "24px",
        "2xl": "32px",
        pill: "9999px",
        full: "9999px",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
        serif: ["var(--font-serif-italic)", "Playfair Display", "Georgia", "serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        sm: "0 2px 6px -1px rgba(28, 25, 23, 0.04), 0 1px 3px -1px rgba(28, 25, 23, 0.02)",
        card: "0 20px 45px -15px rgba(45, 35, 25, 0.07), 0 8px 16px -6px rgba(45, 35, 25, 0.03)",
        "card-hover": "0 30px 60px -15px rgba(45, 35, 25, 0.11), 0 12px 24px -6px rgba(45, 35, 25, 0.04)",
        floating: "0 35px 70px -15px rgba(28, 25, 23, 0.12), 0 15px 30px -8px rgba(28, 25, 23, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
