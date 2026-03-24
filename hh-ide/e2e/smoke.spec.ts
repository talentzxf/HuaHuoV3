import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * smoke.spec.ts
 * Basic smoke tests: page loads, kernel initializes, main UI renders.
 */
test.describe('Smoke — App Startup', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('page has a non-empty title', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test('loading spinner disappears after kernel init', async ({ page }) => {
    await expect(page.getByText('Loading animation engine...')).not.toBeVisible();
  });

  test('main menu renders Save / Open / Play buttons', async ({ page }) => {
    await expect(page.getByRole('button', { name: /\bsave\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bopen\b/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /\bplay\b/i })).toBeVisible();
  });

  test('FlexLayout root container renders', async ({ page }) => {
    // flexlayout-react renders a .flexlayout__layout root node
    await expect(page.locator('.flexlayout__layout')).toBeVisible();
  });

  test('no uncaught JS errors on startup', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.goto('/');
    await page.waitForTimeout(2000);
    expect(errors, `Console errors:\n${errors.join('\n')}`).toHaveLength(0);
  });
});
