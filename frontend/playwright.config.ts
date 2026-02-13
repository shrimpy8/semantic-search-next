import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E test configuration.
 *
 * Requires backend (port 8080) and frontend (port 3000) running.
 * Run with: npx playwright test
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false, // Run sequentially — tests share DB state
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: 'list',
  timeout: 60_000, // 60s per test (search with RAG can be slow)

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Optionally start the Next.js dev server
  // Uncomment if you want Playwright to auto-start the frontend
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 30_000,
  // },
});
