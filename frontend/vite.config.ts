import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

export default defineConfig({
  envPrefix: ["VITE_", "BRAND_", "TEMPMAIL_"],
  plugins: [
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Dev proxy: forwards API + realtime traffic to the local backend and
  // injects the private key server-side, mirroring the Caddy setup in prod.
  // Note: "/api/" (with trailing slash) only matches real backend endpoints;
  // a bare "/api" would also swallow the SPA docs route at /api and 500 it.
  server: {
    proxy: {
      "/api/": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:5001",
        changeOrigin: true,
        headers: {
          "X-API-Key": process.env.API_PROXY_KEY ?? "public-dev-key",
        },
      },
      "/socket.io": {
        target: process.env.API_PROXY_TARGET ?? "http://localhost:5001",
        changeOrigin: true,
        ws: true,
      },
    },
  },
});
