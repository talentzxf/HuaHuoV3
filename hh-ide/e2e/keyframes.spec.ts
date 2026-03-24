import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * keyframes.spec.ts
 *
 * Verifies that drawing a Circle on the canvas automatically generates KeyFrames:
 *  1. Kernel data layer  — the Visual component of the new GameObject has keyframes at frame 0
 *  2. UI layer           — the Timeline canvas renders an orange diamond marker at frame 0
 *
 * Data flow:
 *   CircleTool.onMouseUp
 *     -> Engine.createGameObjectFromPaperItem
 *       -> layer.addGameObject  (-> kernel.createGameObject)
 *         -> gameObject.addComponent('Visual', config)
 *           -> kernel.setKeyframe(goId, 'Visual', propName, currentFrame, value)
 *             -> layer.key_frames updated in stub
 *               -> Timeline track.keyFrames re-renders -> orange diamond
 */

// Mirror constants from Timeline.tsx
const CELL_WIDTH       = 20;
const TRACK_HEIGHT     = 30;
const HEADER_HEIGHT    = 30;
const TRACK_NAME_WIDTH = 120;

/** Return all GameObject IDs in the current scene via window.__kernel_stub__. */
async function getGameObjectIds(page: any): Promise<string[]> {
  return page.evaluate(() => {
    const stub = (window as any).__kernel_stub__;
    if (!stub) return [];
    const result = stub.query({ GetCurrentScene: null });
    return Object.keys(result?.data?.game_objects ?? {});
  });
}

/**
 * Return the keyframe arrays for every component property of a given GO.
 * Shape: { [componentType]: { [propName]: KeyFrame[] } }
 * Reads directly from _state — the stub IS the kernel, _state is the source of truth.
 */
async function getGoKeyframes(
  page: any,
  goId: string
): Promise<Record<string, Record<string, any[]>>> {
  return page.evaluate((id: string) => {
    const stub = (window as any).__kernel_stub__;
    if (!stub) return {};
    const go = stub.getState().gameObjects[id];
    if (!go) return {};
    const out: Record<string, Record<string, any[]>> = {};
    for (const [compType, comp] of Object.entries<any>(go.components ?? {})) {
      out[compType] = {};
      for (const [propName, kfs] of Object.entries<any>(comp.keyFrames ?? {})) {
        out[compType][propName] = kfs;
      }
    }
    return out;
  }, goId);
}

/**
 * Scan a ±dx / ±dy rectangle around (cx, cy) on the given canvas for orange pixels.
 * Orange = keyframe diamond colour #ffa940 (R:255 G:169 B:64).
 * Returns true if at least one matching pixel is found.
 */
async function hasKeyframeDiamondAt(
  page: any,
  trackIndex: number,
  frame: number
): Promise<boolean> {
  // Coordinates match the drawing logic in Timeline.tsx
  const markerCenterX = TRACK_NAME_WIDTH + frame * CELL_WIDTH + CELL_WIDTH / 2; // 130 for frame 0
  const trackY        = HEADER_HEIGHT + trackIndex * TRACK_HEIGHT;
  const markerY       = trackY + TRACK_HEIGHT - 4;

  return page.evaluate(
    ({ cx, cy, selector }: { cx: number; cy: number; selector: string }) => {
      const canvas = document.querySelector(selector) as HTMLCanvasElement | null;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      for (let dx = -6; dx <= 6; dx++) {
        for (let dy = -5; dy <= 5; dy++) {
          const d = ctx.getImageData(cx + dx, cy + dy, 1, 1).data;
          // Allow slight anti-aliasing tolerance around #ffa940
          if (d[0] > 200 && d[1] > 130 && d[1] < 220 && d[2] < 100 && d[3] > 200) {
            return true;
          }
        }
      }
      return false;
    },
    { cx: markerCenterX, cy: markerY, selector: '.timeline-canvas' }
  );
}

/** Shared helper: draw a circle at canvas centre and wait for hierarchy to update. */
async function drawCircleOnCanvas(page: any) {
  const canvas = page.locator('.canvas-drawing-area');
  await page.getByTitle('Draw Circle').click();
  await expect(page.locator('.canvas-status')).toContainText(/circle/i);

  const bbox = await canvas.boundingBox();
  const cx = bbox!.x + bbox!.width / 2;
  const cy = bbox!.y + bbox!.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 60, cy + 60, { steps: 10 });
  await page.mouse.up();

  // Wait until hierarchy reflects the new GameObject
  await expect(
    page.locator('.ant-tree-title').filter({ hasText: /circle/i })
  ).toBeVisible({ timeout: 5_000 });
}

test.describe('KeyFrame Auto-Generation — Draw Circle', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.canvas-drawing-area')).toBeVisible({ timeout: 10_000 });
  });

  // -- Test 1: fresh project has no GameObjects and no KeyFrames ------------------
  test('before drawing — no GameObjects exist', async ({ page }) => {
    const goIds = await getGameObjectIds(page);
    expect(goIds).toHaveLength(0);
  });

  // -- Test 2: kernel data layer has Visual keyframes at frame 0 ------------------
  test('after drawing a Circle — Visual component has keyframes at frame 0', async ({ page }) => {
    // Confirm no GOs before drawing
    expect(await getGameObjectIds(page)).toHaveLength(0);

    await drawCircleOnCanvas(page);

    // Kernel should now have one GO
    const afterIds = await getGameObjectIds(page);
    expect(afterIds.length).toBeGreaterThan(0);
    const goId = afterIds[0];

    // Check kernel data: Visual component must have keyframes at frame 0
    const keyframes = await getGoKeyframes(page, goId);
    expect(keyframes).toHaveProperty('Visual');

    const visualKfs = keyframes['Visual'];
    for (const prop of ['fillColor', 'strokeColor', 'strokeWidth', 'opacity']) {
      expect(visualKfs, `Visual.${prop} should have a keyframe`).toHaveProperty(prop);
      expect(visualKfs[prop][0].frame).toBe(0);
    }
  });

  // -- Test 3: Timeline canvas renders an orange diamond at frame 0 ---------------
  test('after drawing a Circle — Timeline canvas shows orange keyframe diamond at frame 0', async ({ page }) => {
    await drawCircleOnCanvas(page);

    // Timeline becomes visible once tracks.length > 0 (React re-render after kernel event)
    await expect(page.locator('.timeline-canvas')).toBeVisible({ timeout: 5_000 });

    // Allow canvas draw() to complete
    await page.waitForTimeout(300);

    // Layer order: background (trackIndex 0), drawing (trackIndex 1)
    const hasDiamond = await hasKeyframeDiamondAt(page, 1, 0);
    expect(hasDiamond).toBe(true);
  });
});

