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
  // Bundled at start: route chunks load lazily, and a dependency first met on opening a page (the product card's
  // label printing) would make Vite re-bundle and reload the page in the middle of work, or of a browser test.
  optimizeDeps: { include: ["jsbarcode"] },
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
