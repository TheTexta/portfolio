import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".tmp/playwright-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3107",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: {
    command: "npx tsx scripts/tests/start-browser-fixture.mts",
    url: "http://localhost:3107/portfolio",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
