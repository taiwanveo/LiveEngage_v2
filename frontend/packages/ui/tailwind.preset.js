/** LiveEngage 共用 Tailwind preset — 語意 token 對應 theme.css 變數。 */

/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--le-font-sans)", "system-ui", "sans-serif"],
        display: ["var(--le-font-display)", "var(--le-font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--le-font-mono)", "ui-monospace", "monospace"],
      },
      colors: {
        background: "rgb(var(--le-bg) / <alpha-value>)",
        foreground: "rgb(var(--le-fg) / <alpha-value>)",
        surface: "rgb(var(--le-surface) / <alpha-value>)",
        "surface-elevated": "rgb(var(--le-surface-elevated) / <alpha-value>)",
        muted: "rgb(var(--le-muted) / <alpha-value>)",
        border: "rgb(var(--le-border) / <alpha-value>)",
        accent: {
          DEFAULT: "rgb(var(--le-accent) / <alpha-value>)",
          foreground: "rgb(var(--le-accent-fg) / <alpha-value>)",
          muted: "rgb(var(--le-accent-muted) / <alpha-value>)",
        },
        primary: {
          50: "rgb(var(--le-primary-50) / <alpha-value>)",
          100: "rgb(var(--le-primary-100) / <alpha-value>)",
          500: "rgb(var(--le-primary-500) / <alpha-value>)",
          600: "rgb(var(--le-primary-600) / <alpha-value>)",
          700: "rgb(var(--le-primary-700) / <alpha-value>)",
        },
        success: "rgb(var(--le-success) / <alpha-value>)",
        warning: "rgb(var(--le-warning) / <alpha-value>)",
        danger: "rgb(var(--le-danger) / <alpha-value>)",
      },
      boxShadow: {
        card: "var(--le-shadow-card)",
        elevated: "var(--le-shadow-elevated)",
        glow: "var(--le-shadow-glow)",
      },
      borderRadius: {
        xl: "var(--le-radius-xl)",
        "2xl": "var(--le-radius-2xl)",
      },
      backgroundImage: {
        "le-mesh": "var(--le-bg-mesh)",
        "le-grid": "var(--le-bg-grid)",
      },
      animation: {
        "fade-in": "le-fade-in 0.35s ease-out both",
        "slide-up": "le-slide-up 0.4s cubic-bezier(0.22, 1, 0.36, 1) both",
      },
      keyframes: {
        "le-fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "le-slide-up": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
};
