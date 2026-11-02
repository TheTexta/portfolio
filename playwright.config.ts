import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORTFOLIO_TEST_PORT ?? "3107");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORTFOLIO_TEST_PORT must be a valid TCP port");
}

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: ".tmp/playwright-results",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${port}`,
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
    url: `http://localhost:${port}/portfolio`,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
