import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * merge-timeline.spec.ts
 *
 * Validates the MergeFrameSpan behaviour:
 *
 *   • A FrameSpan (clip) can be created on a layer even when there are
 *     NO GameObjects — the operation is purely layer-level.
 *
 *   • Overlapping existing clips are absorbed into the new span.
 *
 *   • The Timeline UI drag → Merge-dialog → Merge flow produces the expected
 *     clip in kernel state and a green rectangle on the canvas.
 *
 * Timeline layout constants (must match Timeline.tsx):
 *   TRACK_NAME_WIDTH = 120 px
 *   CELL_WIDTH       = 20 px
 *   HEADER_HEIGHT    = 30 px
 *   TRACK_HEIGHT     = 30 px
 *
 * Layer order inside CanvasPanel: background (index 0), drawing (index 1)
 */

const CELL_WIDTH       = 20;
const TRACK_HEIGHT     = 30;
const HEADER_HEIGHT    = 30;
const TRACK_NAME_WIDTH = 120;

const DRAWING_TRACK_INDEX = 1;   // background=0, drawing=1
const MERGE_START_FRAME   = 1;
const MERGE_END_FRAME     = 20;

/** CSS-pixel x of the centre of a given frame column, relative to canvas left edge. */
function frameCentreX(frame: number): number {
  return TRACK_NAME_WIDTH + frame * CELL_WIDTH + CELL_WIDTH / 2;
}

/** CSS-pixel y of the centre of a given track row, relative to canvas top edge. */
function trackCentreY(trackIndex: number): number {
  return HEADER_HEIGHT + trackIndex * TRACK_HEIGHT + TRACK_HEIGHT / 2;
}

/** Return the drawing layer object from the kernel stub. */
async function getDrawingLayer(page: any): Promise<any> {
  return page.evaluate(() => {
    const stub = (window as any).__kernel_stub__;
    if (!stub) return null;
    const state = stub.getState();
    return Object.values(state.layers).find((l: any) => l.name === 'drawing') ?? null;
  });
}

/**
 * Scan a horizontal band of the timeline canvas at the drawing-layer row
 * and check whether there are green pixels (clip colour: #73d13d / #52c41a)
 * overlapping the expected clip region [startFrame, endFrame].
 */
async function hasGreenClipAt(
  page: any,
  startFrame: number,
  endFrame: number
): Promise<boolean> {
  const trackY   = trackCentreY(DRAWING_TRACK_INDEX);
  const clipX    = frameCentreX(startFrame);
  const clipEndX = TRACK_NAME_WIDTH + endFrame * CELL_WIDTH + CELL_WIDTH - 2;

  return page.evaluate(
    ({ y, x1, x2 }: { y: number; x1: number; x2: number }) => {
      const canvas = document.querySelector('.timeline-canvas') as HTMLCanvasElement | null;
      if (!canvas) return false;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      for (let x = x1; x <= x2; x += 10) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        // Clip gradient: #73d13d (R:115 G:209 B:61) → #52c41a (R:82 G:196 B:26)
        // Accept: G > R, G > B, G > 150, alpha > 200
        if (d[3] > 200 && d[1] > 150 && d[1] > d[0] && d[1] > d[2]) return true;
      }
      return false;
    },
    { y: trackY, x1: clipX, x2: clipEndX }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('MergeFrameSpan — layer-level, no GameObject required', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.canvas-drawing-area')).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 1: MergeFrameSpan works without any GameObjects ──────────────────
  test('MergeFrameSpan creates a clip on an empty layer (no GO needed)', async ({ page }) => {
    const layerId = await page.evaluate((): string | null => {
      const stub = (window as any).__kernel_stub__;
      if (!stub) return null;
      const state = stub.getState();
      const layer = Object.values(state.layers).find((l: any) => l.name === 'drawing') as any;
      return layer?.id ?? null;
    });

    expect(layerId, 'drawing layer must exist').not.toBeNull();

    // Confirm the layer has no GameObjects at this point.
    const goCount = await page.evaluate((lid: string) => {
      const stub = (window as any).__kernel_stub__;
      return stub.getState().layers[lid]?.game_object_ids?.length ?? 0;
    }, layerId!);
    expect(goCount, 'layer should have 0 GOs for this test').toBe(0);

    // Dispatch MergeFrameSpan directly via the stub — no GO, no keyframes.
    const dispatchResult = await page.evaluate(
      ({ lid, sf, ef }: { lid: string; sf: number; ef: number }) => {
        const stub = (window as any).__kernel_stub__;
        return stub.dispatch({ MergeFrameSpan: { layer_id: lid, start_frame: sf, end_frame: ef } });
      },
      { lid: layerId!, sf: 5, ef: 15 }
    );

    expect(dispatchResult.ok, 'MergeFrameSpan should succeed on empty layer').toBe(true);

    // Verify clip was created.
    const layer = await getDrawingLayer(page);
    expect(layer?.clips?.length, 'drawing layer should have 1 clip').toBe(1);
    expect(layer.clips[0].startFrame, 'clip should start at frame 5').toBe(5);
    expect(layer.clips[0].length, 'clip length should be 11 (frames 5-15)').toBe(11);
  });

  // ── Test 2: Overlapping clips are merged into a single FrameSpan ──────────
  test('MergeFrameSpan absorbs overlapping existing clips into one FrameSpan', async ({ page }) => {
    const layerId = await page.evaluate((): string | null => {
      const stub = (window as any).__kernel_stub__;
      if (!stub) return null;
      const layer = Object.values(stub.getState().layers).find((l: any) => l.name === 'drawing') as any;
      return layer?.id ?? null;
    });
    expect(layerId, 'drawing layer must exist').not.toBeNull();

    // Seed two separate existing clips: [2, 8] and [12, 18].
    await page.evaluate((lid: string) => {
      const stub = (window as any).__kernel_stub__;
      stub.dispatch({ MergeFrameSpan: { layer_id: lid, start_frame: 2, end_frame: 8 } });
      stub.dispatch({ MergeFrameSpan: { layer_id: lid, start_frame: 12, end_frame: 18 } });
    }, layerId!);

    let layer = await getDrawingLayer(page);
    expect(layer?.clips?.length, 'should start with 2 separate clips').toBe(2);

    // Merge a span [5, 15] that overlaps both existing clips.
    // Expected: one clip spanning [2, 18] (union of all three spans).
    await page.evaluate(
      ({ lid, sf, ef }: { lid: string; sf: number; ef: number }) => {
        (window as any).__kernel_stub__.dispatch({ MergeFrameSpan: { layer_id: lid, start_frame: sf, end_frame: ef } });
      },
      { lid: layerId!, sf: 5, ef: 15 }
    );

    layer = await getDrawingLayer(page);
    expect(layer?.clips?.length, 'overlapping clips should be absorbed into one').toBe(1);
    expect(layer.clips[0].startFrame, 'merged clip should start at the earliest overlap (2)').toBe(2);
    // 2 → 18 inclusive = 17 frames
    expect(layer.clips[0].length, 'merged clip should span frames 2–18 (length 17)').toBe(17);
  });

  // ── Test 3: UI flow — drag frames 1-20, confirm dialog, verify clip ───────
  //
  // No circle drawing, no keyframe seeding required — MergeFrameSpan is a
  // layer-level operation and works on an empty layer.
  test('UI drag → Merge dialog → confirm → kernel clip + green canvas rect', async ({ page }) => {
    // Wait for the timeline canvas.
    await expect(page.locator('.timeline-canvas')).toBeVisible({ timeout: 5_000 });
    await page.waitForTimeout(200); // let canvas stabilise

    // Drag frames 1-20 on the drawing layer.
    const timelineCanvas = page.locator('.timeline-canvas');
    const tcBBox = await timelineCanvas.boundingBox();
    expect(tcBBox, 'timeline-canvas must be visible').not.toBeNull();

    const startX = tcBBox!.x + frameCentreX(MERGE_START_FRAME);
    const endX   = tcBBox!.x + frameCentreX(MERGE_END_FRAME);
    const dragY  = tcBBox!.y + trackCentreY(DRAWING_TRACK_INDEX);

    await page.mouse.move(startX, dragY);
    await page.mouse.down();
    await page.mouse.move(endX, dragY, { steps: 20 });
    await page.mouse.up();

    // Merge dialog should appear.
    await expect(page.getByText('Merge Cells')).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText(/frames? 1 to 20/i)).toBeVisible();

    // Click "Merge".
    await page.getByRole('button', { name: /^Merge$/i }).click();

    // Dialog must close.
    await expect(page.getByText('Merge Cells')).not.toBeVisible({ timeout: 3_000 });

    // Verify kernel data: layer.clips has the expected clip.
    const layer = await getDrawingLayer(page);
    expect(layer?.clips?.length, 'drawing layer should have at least one clip').toBeGreaterThan(0);

    const clip = layer.clips.find(
      (c: any) =>
        c.startFrame === MERGE_START_FRAME &&
        c.length === MERGE_END_FRAME - MERGE_START_FRAME + 1
    );
    expect(
      clip,
      `expected clip {startFrame:${MERGE_START_FRAME}, length:${MERGE_END_FRAME - MERGE_START_FRAME + 1}}`
    ).toBeTruthy();

    // Allow React + canvas redraw.
    await page.waitForTimeout(300);

    // Verify Timeline UI: green clip rectangle is rendered.
    const hasClip = await hasGreenClipAt(page, MERGE_START_FRAME, MERGE_END_FRAME);
    expect(hasClip, 'Timeline canvas should render a green clip for the merged range').toBe(true);
  });
});



