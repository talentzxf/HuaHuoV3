import { type Page, expect } from '@playwright/test';

/**
 * Wait for the kernel to finish initializing (Spin gone, main menu visible).
 */
export async function waitForAppReady(page: Page) {
  // Spin disappears
  await expect(page.getByText('Loading animation engine...')).not.toBeVisible({
    timeout: 20_000,
  });
  // Play button visible in main menu
  await expect(page.getByRole('button', { name: /\bplay\b/i })).toBeVisible({
    timeout: 10_000,
  });
}

/**
 * Navigate to the app root and wait until it is ready.
 */
export async function gotoApp(page: Page) {
  await page.goto('/');
  await waitForAppReady(page);
}
