import { defineConfig, devices } from "@playwright/test"

// Browser checks run against the dev server with the API mocked per test (`e2e/support`), so they
// need no running TradeNet. A port of their own keeps them clear of the dev server on 5173.
const port = 5174

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Two browsers at a time: with Playwright's default (half the cores) the dev server's first compile of each page
  // competed with the owner's IDEs, and tests failed on timeouts that no test code caused. Two pass reliably here.
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    // The installed Google Chrome instead of Playwright's own ~200 MB Chromium download.
    channel: "chrome",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], channel: "chrome" },
    },
    { name: "phone", use: { ...devices["Pixel 7"], channel: "chrome" } },
  ],
  webServer: {
    command: `npx vite --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: false,
    // Tests mock every /api call (e2e/support/api.ts). Should one slip through, it goes to a closed port, never
    // to a TradeNet running on this machine (the owner's API on 5129).
    env: { API_URL: "http://127.0.0.1:9" },
  },
})
