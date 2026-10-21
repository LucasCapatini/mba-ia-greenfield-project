import { defineConfig, devices } from "@playwright/test";

// Full-stack E2E (home-search-production/TD-06): browser → BFF → API → worker → storage → Mailpit,
// with NO MSW. Both stacks must be up (backend `up` + `migration:run` + `start:dev`; frontend
// `next build` + `next start` WITHOUT `MSW_ENABLED`). Playwright runs on the HOST and never manages
// the servers — no `webServer`. `--grep @smoke` runs only the read-only smoke reused by the deploy.
export default defineConfig({
  testDir: "./full-stack",
  testMatch: "**/*.e2e-spec.ts",
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Journeys create their own users but share the real database and the worker queue.
  workers: 1,
  // Upload + FFmpeg processing by the worker take longer than a mocked flow.
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report-full-stack", open: "never" }]],
  use: {
    baseURL: process.env.FULL_STACK_BASE_URL ?? "http://localhost:3001",
    // Only for the local validation of the production compose (https://localhost, Caddy local CA).
    ignoreHTTPSErrors: process.env.FULL_STACK_IGNORE_HTTPS_ERRORS === "true",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
