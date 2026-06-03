import { config as loadEnv } from "dotenv";
import { defineConfig, devices } from "@playwright/test";

// Load the local Supabase service-role env (.env.test) so the test-runner's
// nutrition harness (ensureTestTenant/Trainer, cleanup) talks to the local
// stack. The auth helper separately loads JWT_SECRET from .env.local. The
// already-running dev server keeps its own env (reuseExistingServer below).
loadEnv({ path: ".env.test" });

const baseURL = "http://localhost:3000";

// Boots the Next.js dev server for the test run and reuses an already-running
// server locally so the suite is fast to iterate on.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
