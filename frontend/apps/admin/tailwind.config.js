import liveengagePreset from "../../packages/ui/tailwind.preset.js";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [liveengagePreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  plugins: [],
};
