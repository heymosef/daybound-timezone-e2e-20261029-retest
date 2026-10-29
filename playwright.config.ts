import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  testMatch: "**/*.spec.ts",
  forbidOnly: !!process.env.CI,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 25_000,
  globalTimeout: 240_000,
  expect: { timeout: 5_000 },
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:4176",
    timezoneId: "UTC",
    locale: "en-US",
    serviceWorkers: "block",
    trace: "retain-on-failure",
    screenshot: "off",
    video: "off",
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 900 } } },
    { name: "narrow", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    command: "node scripts/browser-fixtures.mjs && node scripts/serve-browser-fixtures.mjs",
    url: "http://127.0.0.1:4176",
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
