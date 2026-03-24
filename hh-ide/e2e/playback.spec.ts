import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * playback.spec.ts
 * Tests the Play / Pause / Stop button flow in the main menu.
 *
 * Initial state : only [Play] visible
 * Click Play    : [Pause] + [Stop] appear, [Play] disappears
 * Click Pause   : back to [Play]
 * Click Play, then Stop : back to [Play]
 */
test.describe('Playback Controls — Play / Pause / Stop', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('initial state shows only Play button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /\bplay\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bpause\b/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /\bstop\b/i })).not.toBeVisible();
  });

  test('clicking Play shows Pause and Stop', async ({ page }) => {
    await page.getByRole('button', { name: /\bplay\b/i }).click();

    await expect(page.getByRole('button', { name: /\bpause\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bstop\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bplay\b/i })).not.toBeVisible();
  });

  test('clicking Play then Pause returns to Play', async ({ page }) => {
    await page.getByRole('button', { name: /\bplay\b/i }).click();
    await page.getByRole('button', { name: /\bpause\b/i }).click();

    await expect(page.getByRole('button', { name: /\bplay\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bpause\b/i })).not.toBeVisible();
  });

  test('clicking Play then Stop returns to Play', async ({ page }) => {
    await page.getByRole('button', { name: /\bplay\b/i }).click();
    await expect(page.getByRole('button', { name: /\bstop\b/i })).toBeVisible();
    await page.getByRole('button', { name: /\bstop\b/i }).click();

    await expect(page.getByRole('button', { name: /\bplay\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bpause\b/i })).not.toBeVisible();
  });

  test('clicking Play shows antd "Playing..." message', async ({ page }) => {
    await page.getByRole('button', { name: /\bplay\b/i }).click();
    await expect(page.locator('.ant-message-notice')).toContainText(/playing/i);
  });

  test('clicking Stop shows antd "Stopped" message', async ({ page }) => {
    await page.getByRole('button', { name: /\bplay\b/i }).click();
    await page.getByRole('button', { name: /\bstop\b/i }).click();
    await expect(page.locator('.ant-message-notice')).toContainText(/stopped/i);
  });
});
