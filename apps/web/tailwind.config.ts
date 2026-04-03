import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./stores/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#08090E",
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.02)",
          elevated: "rgba(255, 255, 255, 0.04)",
        },
        border: {
          DEFAULT: "rgba(255, 255, 255, 0.08)",
          hover: "rgba(255, 255, 255, 0.15)",
          glass: "rgba(255,255,255,0.08)",
        },
        text: {
          primary: "#FFFFFF",
          secondary: "#A0A0A0",
        },
        accent: {
          violet: "#7C3AED", // Electric Violet
          cyan: "#00D4FF", // Neon Cyan
          muted: "rgba(124, 58, 237, 0.2)",
        },
        alert: {
          red: "#ef4444",
        },
        online: {
          green: "#22c55e",
        },
        offline: {
          gray: "#3f3f46",
        },
        warning: {
          amber: "#f59e0b",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        display: ["var(--font-syne)", "sans-serif"],
      },
      animation: {
        "marquee": "marquee 25s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "fade-in": "fadeIn 0.5s ease-out",
        "slide-up": "slideUp 0.5s ease-out",
        "text-reveal": "textReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      },
      keyframes: {
        marquee: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        textReveal: {
          "0%": { opacity: "0", transform: "translateY(40px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
