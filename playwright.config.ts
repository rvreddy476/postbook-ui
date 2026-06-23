import { defineConfig, devices } from "@playwright/test"

// Thin web E2E smoke (docs/TESTING.md W5). Runs against an already-running web
// app + backend stack — set E2E_BASE_URL to the web origin (default the local
// dev server). The app's /api/proxy forwards to the gateway, so a full stack
// must be up for the auth/post/admin journeys; the render-only checks pass
// without a backend.
//
//   E2E_BASE_URL=http://localhost:3000 bun run test:e2e
//
// Login-gated specs additionally need seeded credentials:
//   E2E_EMAIL=... E2E_PASSWORD=...            (a normal user)
//   E2E_SUPERADMIN_EMAIL=... E2E_SUPERADMIN_PASSWORD=...  (admin journeys)
// They skip cleanly when those are absent.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
})
