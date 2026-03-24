import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration
 *
 * Start the dev server before running tests:
 *   pnpm dev:ide  (or pnpm start)
 *
 * Run tests:
 *   pnpm test:e2e           # headless, all tests
 *   pnpm test:e2e:ui        # open Playwright UI mode
 *   pnpm test:e2e:report    # view last HTML report
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['list'],
  ],

  use: {
    baseURL: 'http://localhost:3006',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    // Allow up to 15 s for the kernel to initialise before actions time out
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // webkit only on CI
    ...(process.env.CI
      ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
      : []),
  ],

  // Auto-start the dev server when it is not already running
  webServer: {
    command: 'pnpm start',
    url: 'http://localhost:3006',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
