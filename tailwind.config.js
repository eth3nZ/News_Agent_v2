/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js}", "./src/index.html"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: "#121214",
          card: "#1a1a1e",
          hover: "#27272a",
          modal: "#1a1a1e",
          light: "#F4F4F5",
          "light-card": "#FFFFFF",
          "light-hover": "#E4E4E7",
          "light-modal": "#FFFFFF",
        },
        accent: {
          DEFAULT: "#f59e0b",
          light: "#d97706",
        },
        score: {
          high: "#22c55e",
          mid: "#3B82F6",
          low: "#f59e0b",
          poor: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        serif: ["Georgia", "serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
        "pulse-dot": "pulseDot 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseDot: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.4" },
        },
      },
    },
  },
  plugins: [],
};