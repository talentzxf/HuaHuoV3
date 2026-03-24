import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * hierarchy.spec.ts
 * Tests for the Hierarchy Panel (Scene -> Layer -> GameObject tree).
 * Uses antd Tree component internally.
 */
test.describe('Hierarchy Panel', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('hierarchy tree container is attached to the DOM', async ({ page }) => {
    // Just confirm the antd tree renders without error (may be empty on fresh load)
    await expect(page.locator('.ant-tree').first()).toBeAttached({ timeout: 10_000 });
  });

  test('no crash when there is no Scene on startup', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    await page.waitForTimeout(1000);
    expect(errors).toHaveLength(0);
  });

  test('tree stays stable after kernel stub dispatches CreateScene', async ({ page }) => {
    await page.evaluate(async () => {
      const stub = (window as any).__kernel_stub__;
      if (!stub) return;
      stub.dispatch({ CreateProject: { name: 'E2E Project', fps: 30, canvas_width: 800, canvas_height: 600 } });
      stub.dispatch({ CreateScene: { name: 'E2E Scene', fps: 30, duration: 5 } });
    });

    await page.waitForTimeout(500);
    await expect(page.locator('.ant-tree')).toBeAttached();
  });

  test('draw a Circle — hierarchy tree shows the new GameObject', async ({ page }) => {
    const canvas = page.locator('.canvas-drawing-area');
    await expect(canvas).toBeVisible({ timeout: 10_000 });

    // Select circle tool
    await page.getByTitle('Draw Circle').click();
    await expect(page.locator('.canvas-status')).toContainText(/circle/i);

    // Draw on canvas
    const bbox = await canvas.boundingBox();
    const cx = bbox!.x + bbox!.width / 2;
    const cy = bbox!.y + bbox!.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + 60, cy + 60, { steps: 10 });
    await page.mouse.up();

    // The first circle is named "circle-1" by generateUniqueName
    await expect(
      page.locator('.ant-tree-title').filter({ hasText: /circle/i })
    ).toBeVisible({ timeout: 5_000 });
  });
});
