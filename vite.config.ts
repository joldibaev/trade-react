import { resolve } from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// The API the dev server forwards /api to. Another copy of TradeNet: `API_URL=http://localhost:5199`.
const apiUrl = process.env.API_URL ?? "http://localhost:5129"

export default defineConfig({
  plugins: [
    // Must run before the React plugin: it turns files in src/routes into the route tree.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      // No `changeOrigin`: TradeNet's CSRF check compares `Origin` with the `Host` it receives,
      // so the browser's Host (localhost:5173) must reach the API unchanged.
      "/api": { target: apiUrl },
    },
  },
})
