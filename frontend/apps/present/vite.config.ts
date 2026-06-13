import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@liveengage/renderers": path.resolve(
        __dirname,
        "../../packages/renderers/src/index.ts"
      ),
      "@liveengage/realtime": path.resolve(
        __dirname,
        "../../packages/realtime/src/index.ts"
      ),
    },
  },
  server: {
    port: 5175,
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
