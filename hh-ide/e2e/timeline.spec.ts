import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * timeline.spec.ts
 * Tests for the Timeline Panel rendering and playback integration.
 */
test.describe('Timeline Panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('timeline tab label is visible', async ({ page }) => {
    const timelineTab = page.getByText(/timeline/i).first();
    await expect(timelineTab).toBeVisible({ timeout: 10_000 });
  });

  test('no crash on timeline render', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('timeline stays stable while playing and after stop', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    await page.getByRole('button', { name: /\bplay\b/i }).click();
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /\bstop\b/i }).click();

    expect(errors).toHaveLength(0);
    await expect(page.getByText(/timeline/i).first()).toBeVisible();
  });
});
