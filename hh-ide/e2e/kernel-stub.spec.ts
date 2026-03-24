import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * kernel-stub.spec.ts
 * Validates the kernel-wasm JS stub behaviour inside a browser context.
 * Uses window.__kernel_stub__ directly — no UI interaction needed.
 */
test.describe('Kernel WASM Stub (browser)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
  });

  test('__kernel_stub__ is mounted on window', async ({ page }) => {
    const exists = await page.evaluate(() => !!(window as any).__kernel_stub__);
    expect(exists).toBe(true);
  });

  test('initial playback state has is_playing = false', async ({ page }) => {
    const state = await page.evaluate(() => {
      const stub = (window as any).__kernel_stub__;
      return stub?.getState()?.playback ?? null;
    });
    expect(state).not.toBeNull();
    expect(state.is_playing).toBe(false);
  });

  test('dispatching CreateProject returns ok: true', async ({ page }) => {
    const result = await page.evaluate(() => {
      const stub = (window as any).__kernel_stub__;
      if (!stub) return { ok: false, skipped: true };
      return stub.dispatch({
        CreateProject: { name: 'pw-test', fps: 30, canvas_width: 800, canvas_height: 600 }
      });
    });
    if (!result.skipped) {
      expect(result.ok).toBe(true);
      expect(result.created_id).toBeTruthy();
    }
  });
});
