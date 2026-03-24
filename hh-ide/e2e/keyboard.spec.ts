import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * keyboard.spec.ts
 * Tests keyboard shortcuts registered in MainMenu.
 */
test.describe('Keyboard Shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('Ctrl+S triggers Save — shows success message', async ({ page }) => {
    await page.keyboard.press('Control+s');
    await expect(page.locator('.ant-message-notice')).toContainText(/saved/i);
  });

  test('Ctrl+O triggers Open — shows message', async ({ page }) => {
    await page.keyboard.press('Control+o');
    await expect(page.locator('.ant-message-notice')).toContainText(/opening/i);
  });

  test('Ctrl+Z triggers Undo — shows message', async ({ page }) => {
    await page.keyboard.press('Control+z');
    await expect(page.locator('.ant-message-notice')).toContainText(/undo/i);
  });

  test('Ctrl+Y triggers Redo — shows message', async ({ page }) => {
    await page.keyboard.press('Control+y');
    await expect(page.locator('.ant-message-notice')).toContainText(/redo/i);
  });
});
