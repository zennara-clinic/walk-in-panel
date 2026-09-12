import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * The walk-in check-in tablet. Deployed on its own, talks straight to the
 * Zennara backend — set VITE_API_BASE_URL to the API origin
 * (https://api.zennara.in in production). In dev it proxies to the local
 * backend on :8000 so the default build needs no environment at all.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5176,
    proxy: { "/api": { target: "http://localhost:8000", changeOrigin: true } },
  },
});
