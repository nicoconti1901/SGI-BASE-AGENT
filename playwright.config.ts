import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";

// Cada worktree tiene su PORT en el .env (scripts/wt-setup.mjs): así el e2e nunca
// reutiliza el servidor de otro worktree. Next no lee PORT del .env, por eso va en el comando.
const port = Number(process.env.PORT) || 3000;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
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
    command: `npm run dev -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
