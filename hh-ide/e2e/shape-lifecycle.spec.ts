import { test, expect } from '@playwright/test';
import { gotoApp } from './helpers';

/**
 * shape-lifecycle.spec.ts
 *
 * Validates Shape (GameObject) visibility lifecycle rules:
 *
 *   NEW MODEL — "1 frame = 1 span":
 *   • When a shape is drawn on frame X via Layer.addGameObject(), the engine
 *     automatically creates a 1-frame FrameSpan [X, X] on the layer.
 *   • The shape is therefore visible ONLY at frame X by default.
 *   • Use "Merge Cells" in the timeline to extend the span to [X, Y].
 *
 *   KERNEL RULE (GetActiveGameObjects):
 *   • If the layer has clips: GO is active only when currentFrame is inside a clip
 *     AND currentFrame ≥ born_frame.
 *   • If the layer has NO clips (raw kernel dispatch only): GO is active at every
 *     frame ≥ born_frame (legacy / degenerate case).
 *
 *   BUG FIX — keyframes must survive MergeFrameSpan:
 *   • MergeFrameSpan creates/extends a clip span.
 *   • It must NOT remove key_frames[] markers from the layer.
 *     key_frames[] is managed solely by SetKeyFrame / RemoveKeyFrame.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

async function getDrawingLayerId(page: any): Promise<string> {
  return page.evaluate((): string => {
    const stub = (window as any).__kernel_stub__;
    const layer = Object.values(stub.getState().layers).find((l: any) => l.name === 'drawing') as any;
    return layer?.id ?? '';
  });
}

async function getSceneId(page: any): Promise<string> {
  return page.evaluate((): string => {
    const stub = (window as any).__kernel_stub__;
    return stub.getState().project?.current_scene_id ?? '';
  });
}

/** GetActiveGameObjects is a kernel query (not a command). */
async function getActiveGOs(page: any, sceneId: string, frame: number): Promise<string[]> {
  return page.evaluate(
    ({ sid, f }: { sid: string; f: number }) => {
      const stub = (window as any).__kernel_stub__;
      return stub.query({ GetActiveGameObjects: { scene_id: sid, frame: f } }).data ?? [];
    },
    { sid: sceneId, f: frame }
  );
}

/**
 * Raw kernel CreateGameObject — bypasses Layer.addGameObject (no auto-clip).
 * Use this when you want to test the kernel lifecycle rule in isolation.
 */
async function createGO(page: any, layerId: string, name: string, bornFrame: number): Promise<string> {
  return page.evaluate(
    ({ lid, n, bf }: { lid: string; n: string; bf: number }) => {
      const stub = (window as any).__kernel_stub__;
      return stub.dispatch({ CreateGameObject: { layer_id: lid, name: n, born_frame: bf } }).created_id;
    },
    { lid: layerId, n: name, bf: bornFrame }
  );
}

/** Simulate what Layer.addGameObject does: CreateGameObject + 1-frame MergeFrameSpan. */
async function createGOWithAutoSpan(page: any, layerId: string, name: string, bornFrame: number): Promise<string> {
  return page.evaluate(
    ({ lid, n, bf }: { lid: string; n: string; bf: number }) => {
      const stub = (window as any).__kernel_stub__;
      const goId = stub.dispatch({ CreateGameObject: { layer_id: lid, name: n, born_frame: bf } }).created_id;
      // Auto-create 1-frame span (what Layer.addGameObject now does)
      stub.dispatch({ MergeFrameSpan: { layer_id: lid, start_frame: bf, end_frame: bf } });
      return goId;
    },
    { lid: layerId, n: name, bf: bornFrame }
  );
}

async function mergeSpan(page: any, layerId: string, start: number, end: number): Promise<void> {
  await page.evaluate(
    ({ lid, s, e }: { lid: string; s: number; e: number }) => {
      (window as any).__kernel_stub__.dispatch({
        MergeFrameSpan: { layer_id: lid, start_frame: s, end_frame: e },
      });
    },
    { lid: layerId, s: start, e: end }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Shape lifecycle — born_frame + clip-based visibility', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.canvas-drawing-area')).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 1: Kernel fallback — no clips → visible after born_frame ─────────
  // (raw CreateGameObject only; real usage always creates a 1-frame span)
  test('[kernel] no clips: shape visible at and after born_frame, invisible before', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeA', 10);
    expect(goId).not.toBe('');

    let active = await getActiveGOs(page, sceneId, 5);
    expect(active, 'before born_frame → invisible').not.toContain(goId);

    active = await getActiveGOs(page, sceneId, 10);
    expect(active, 'at born_frame (no clips) → visible').toContain(goId);

    active = await getActiveGOs(page, sceneId, 50);
    expect(active, 'after born_frame, no clips → still visible').toContain(goId);
  });

  // ── Test 2: "1 frame = 1 span" — the real model ──────────────────────────
  // createGOWithAutoSpan simulates what Layer.addGameObject now does.
  test('[real model] shape created at frame X only visible at frame X by default', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    // Draw shape at frame 10 → auto-creates clip [10, 10]
    const goId = await createGOWithAutoSpan(page, layerId, 'ShapeReal', 10);
    expect(goId).not.toBe('');

    // Before born_frame → invisible
    let active = await getActiveGOs(page, sceneId, 5);
    expect(active, 'frame 5: before born_frame → invisible').not.toContain(goId);

    // At exactly born_frame (the 1-frame span) → visible
    active = await getActiveGOs(page, sceneId, 10);
    expect(active, 'frame 10: inside 1-frame span → visible').toContain(goId);

    // Frame after the span → invisible (lifecycle expired)
    active = await getActiveGOs(page, sceneId, 11);
    expect(active, 'frame 11: outside span → invisible').not.toContain(goId);

    active = await getActiveGOs(page, sceneId, 50);
    expect(active, 'frame 50: well after span → invisible').not.toContain(goId);
  });

  // ── Test 3: Extend the span with Merge Cells ──────────────────────────────
  test('merging frames extends the lifetime of the shape', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    // Create shape at frame 5 with default 1-frame span
    const goId = await createGOWithAutoSpan(page, layerId, 'ShapeExtend', 5);

    // Confirm only at frame 5 initially
    let active = await getActiveGOs(page, sceneId, 5);
    expect(active, 'frame 5: inside initial span → visible').toContain(goId);
    active = await getActiveGOs(page, sceneId, 6);
    expect(active, 'frame 6: outside initial span → invisible').not.toContain(goId);

    // User merges cells 5-20 → extends the span to [5, 20]
    await mergeSpan(page, layerId, 5, 20);

    active = await getActiveGOs(page, sceneId, 15);
    expect(active, 'frame 15: inside extended span [5,20] → visible').toContain(goId);
    active = await getActiveGOs(page, sceneId, 21);
    expect(active, 'frame 21: after extended span → invisible').not.toContain(goId);
  });

  // ── Test 4: born_frame inside clip ────────────────────────────────────────
  test('born_frame inside clip: invisible before born_frame, visible from born_frame', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    // First extend the layer with a clip [10, 50]
    await mergeSpan(page, layerId, 10, 50);
    // Create shape born at frame 25 (inside the clip)
    const goId = await createGO(page, layerId, 'ShapeC', 25);

    // Inside clip but before born_frame → invisible
    let active = await getActiveGOs(page, sceneId, 15);
    expect(active, 'frame 15: inside clip but before born_frame=25 → invisible').not.toContain(goId);

    // At born_frame (inside clip) → visible
    active = await getActiveGOs(page, sceneId, 25);
    expect(active, 'frame 25: born_frame inside clip → visible').toContain(goId);

    // After clip → invisible
    active = await getActiveGOs(page, sceneId, 51);
    expect(active, 'frame 51: after clip → invisible').not.toContain(goId);
  });

  // ── Test 5: Multiple clips → visible in each, invisible between ───────────
  test('multiple clips: shape visible in each clip, invisible between', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeD', 0);
    await mergeSpan(page, layerId, 5, 15);
    await mergeSpan(page, layerId, 25, 35);

    let active = await getActiveGOs(page, sceneId, 10);
    expect(active, 'frame 10: inside clip [5,15] → visible').toContain(goId);

    active = await getActiveGOs(page, sceneId, 20);
    expect(active, 'frame 20: between clips → invisible').not.toContain(goId);

    active = await getActiveGOs(page, sceneId, 30);
    expect(active, 'frame 30: inside clip [25,35] → visible').toContain(goId);

    active = await getActiveGOs(page, sceneId, 36);
    expect(active, 'frame 36: after all clips → invisible').not.toContain(goId);
  });

  // ── Test 6: Overlapping clips merge into one span ─────────────────────────
  test('overlapping MergeFrameSpan calls merge into one span', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeE', 0);
    await mergeSpan(page, layerId, 5, 20);
    await mergeSpan(page, layerId, 15, 30); // overlaps → merged into [5, 30]

    const clips = await page.evaluate((lid: string) => {
      return (window as any).__kernel_stub__.getState().layers[lid]?.clips ?? [];
    }, layerId);
    expect(clips.length, 'two overlapping spans should merge into one').toBe(1);
    expect(clips[0].startFrame).toBe(5);
    expect(clips[0].length).toBe(26); // 5→30 inclusive

    let active = await getActiveGOs(page, sceneId, 4);
    expect(active, 'frame 4: before merged span → invisible').not.toContain(goId);
    active = await getActiveGOs(page, sceneId, 17);
    expect(active, 'frame 17: inside merged span → visible').toContain(goId);
    active = await getActiveGOs(page, sceneId, 31);
    expect(active, 'frame 31: after merged span → invisible').not.toContain(goId);
  });

  // ── Test 7: MergeFrameSpan must NOT erase key_frames markers ─────────────
  test('[bug fix] MergeFrameSpan does not erase key_frames on the layer', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeKF', 0);

    // Seed keyframes at frames 5, 10, 15 on the GO
    await page.evaluate(
      ({ gid }: { gid: string }) => {
        const stub = (window as any).__kernel_stub__;
        for (const f of [5, 10, 15]) {
          stub.dispatch({
            SetKeyFrame: {
              game_object_id: gid,
              component_type: 'Transform',
              prop_name: 'position',
              keyframe: { frame: f, value: { x: f * 10, y: 0 }, easing: 'linear' },
            },
          });
        }
      },
      { gid: goId }
    );

    // Confirm all 3 key_frames are in the layer
    let layerState = await page.evaluate((lid: string) => {
      return (window as any).__kernel_stub__.getState().layers[lid];
    }, layerId);
    expect(layerState.key_frames, 'layer should have 3 keyframe markers before merge')
      .toEqual(expect.arrayContaining([5, 10, 15]));

    // Now merge cells 1-20 (covers all 3 keyframes)
    await mergeSpan(page, layerId, 1, 20);

    // key_frames MUST still contain all 3 markers
    layerState = await page.evaluate((lid: string) => {
      return (window as any).__kernel_stub__.getState().layers[lid];
    }, layerId);
    expect(layerState.key_frames, 'MergeFrameSpan must NOT erase keyframe markers at 5, 10, 15')
      .toEqual(expect.arrayContaining([5, 10, 15]));

    // Clip should exist
    expect(layerState.clips.length, 'clip should be created').toBe(1);
    expect(layerState.clips[0].startFrame).toBe(1);
    expect(layerState.clips[0].length).toBe(20);
  });
});


/**
 * shape-lifecycle.spec.ts
 *
 * Validates that Shape (GameObject) visibility respects the lifecycle rule:
 *
 *   • A shape with born_frame B is invisible before frame B.
 *   • On a layer with NO clips: shape is visible at every frame ≥ B.
 *   • On a layer WITH clips: shape is visible ONLY when the current frame
 *     is inside one of those clips AND frame ≥ B.
 *     → outside clips = shape disappears (lifecycle expired).
 *
 * All assertions are done through the kernel stub's GetActiveGameObjects
 * query so they are engine-level (not UI pixel) checks and run headlessly.
 */

// ── helpers ──────────────────────────────────────────────────────────────────

/** Returns the drawing layer's id from the kernel stub. */
async function getDrawingLayerId(page: any): Promise<string> {
  return page.evaluate((): string => {
    const stub = (window as any).__kernel_stub__;
    const layer = Object.values(stub.getState().layers).find((l: any) => l.name === 'drawing') as any;
    return layer?.id ?? '';
  });
}

/** Returns the current scene id. */
async function getSceneId(page: any): Promise<string> {
  return page.evaluate((): string => {
    const stub = (window as any).__kernel_stub__;
    return stub.getState().project?.current_scene_id ?? '';
  });
}

/**
 * Ask the kernel: which GOs are "active" (visible) at a given frame?
 */
async function getActiveGOs(page: any, sceneId: string, frame: number): Promise<string[]> {
  return page.evaluate(
    ({ sid, f }: { sid: string; f: number }) => {
      const stub = (window as any).__kernel_stub__;
      // GetActiveGameObjects is a kernel *query* (not a command).
      return stub.query({ GetActiveGameObjects: { scene_id: sid, frame: f } }).data ?? [];
    },
    { sid: sceneId, f: frame }
  );
}

/** Create a GO on a layer via the stub. */
async function createGO(page: any, layerId: string, name: string, bornFrame: number): Promise<string> {
  return page.evaluate(
    ({ lid, n, bf }: { lid: string; n: string; bf: number }) => {
      const stub = (window as any).__kernel_stub__;
      return stub.dispatch({ CreateGameObject: { layer_id: lid, name: n, born_frame: bf } }).created_id;
    },
    { lid: layerId, n: name, bf: bornFrame }
  );
}

/** Merge a FrameSpan (clip) on a layer via the stub. */
async function mergeSpan(page: any, layerId: string, start: number, end: number): Promise<void> {
  await page.evaluate(
    ({ lid, s, e }: { lid: string; s: number; e: number }) => {
      (window as any).__kernel_stub__.dispatch({
        MergeFrameSpan: { layer_id: lid, start_frame: s, end_frame: e },
      });
    },
    { lid: layerId, s: start, e: end }
  );
}

// ─────────────────────────────────────────────────────────────────────────────
test.describe('Shape lifecycle — born_frame + clip-based visibility', () => {
  test.beforeEach(async ({ page }) => {
    await gotoApp(page);
    await expect(page.locator('.canvas-drawing-area')).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 1: No clips → visible after born_frame, invisible before ─────────
  test('no clips: shape visible at and after born_frame, invisible before', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);
    expect(layerId, 'drawing layer must exist').not.toBe('');

    const goId = await createGO(page, layerId, 'ShapeA', 10 /* born at frame 10 */);
    expect(goId, 'GO must be created').not.toBe('');

    // Before born_frame → invisible.
    let active = await getActiveGOs(page, sceneId, 5);
    expect(active, 'shape must NOT be active at frame 5 (before born_frame 10)').not.toContain(goId);

    // At born_frame → visible.
    active = await getActiveGOs(page, sceneId, 10);
    expect(active, 'shape must be active at frame 10 (born_frame)').toContain(goId);

    // After born_frame (no clips) → still visible.
    active = await getActiveGOs(page, sceneId, 50);
    expect(active, 'shape must be active at frame 50 (no clips, after born_frame)').toContain(goId);
  });

  // ── Test 2: With clips → visible only inside clips ────────────────────────
  test('with clips: shape disappears outside clip spans', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    // Create shape born at frame 0 (always born).
    const goId = await createGO(page, layerId, 'ShapeB', 0);

    // Merge a single clip [20, 40].
    await mergeSpan(page, layerId, 20, 40);

    // Before clip → shape is outside lifecycle → invisible.
    let active = await getActiveGOs(page, sceneId, 5);
    expect(active, 'shape must NOT be active at frame 5 (before clip [20,40])').not.toContain(goId);

    // Inside clip → visible.
    active = await getActiveGOs(page, sceneId, 20);
    expect(active, 'shape must be active at frame 20 (start of clip)').toContain(goId);

    active = await getActiveGOs(page, sceneId, 30);
    expect(active, 'shape must be active at frame 30 (inside clip)').toContain(goId);

    active = await getActiveGOs(page, sceneId, 40);
    expect(active, 'shape must be active at frame 40 (end of clip)').toContain(goId);

    // After clip → shape lifecycle expired → invisible.
    active = await getActiveGOs(page, sceneId, 41);
    expect(active, 'shape must NOT be active at frame 41 (after clip [20,40])').not.toContain(goId);

    active = await getActiveGOs(page, sceneId, 100);
    expect(active, 'shape must NOT be active at frame 100 (well after clip)').not.toContain(goId);
  });

  // ── Test 3: born_frame after clip start → invisible before born_frame ─────
  test('born_frame inside clip: shape invisible before born_frame, visible from born_frame', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    // Clip [10, 50], shape born at frame 25.
    await mergeSpan(page, layerId, 10, 50);
    const goId = await createGO(page, layerId, 'ShapeC', 25);

    // Inside clip but before born_frame → invisible.
    let active = await getActiveGOs(page, sceneId, 15);
    expect(active, 'shape must NOT be active at frame 15 (inside clip but born_frame=25)').not.toContain(goId);

    // At born_frame (inside clip) → visible.
    active = await getActiveGOs(page, sceneId, 25);
    expect(active, 'shape must be active at frame 25 (born_frame, inside clip)').toContain(goId);

    // After born_frame, still inside clip → visible.
    active = await getActiveGOs(page, sceneId, 45);
    expect(active, 'shape must be active at frame 45 (after born, inside clip)').toContain(goId);

    // After clip → lifecycle expired.
    active = await getActiveGOs(page, sceneId, 51);
    expect(active, 'shape must NOT be active at frame 51 (after clip)').not.toContain(goId);
  });

  // ── Test 4: Multiple clips → visible in ALL clips, invisible between ───────
  test('multiple clips: shape visible in each clip, invisible between clips', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeD', 0);

    // Two separate clips: [5, 15] and [25, 35].
    await mergeSpan(page, layerId, 5, 15);
    await mergeSpan(page, layerId, 25, 35);

    // Inside first clip.
    let active = await getActiveGOs(page, sceneId, 10);
    expect(active, 'shape must be active at frame 10 (inside clip [5,15])').toContain(goId);

    // Between clips → invisible.
    active = await getActiveGOs(page, sceneId, 20);
    expect(active, 'shape must NOT be active at frame 20 (between clips)').not.toContain(goId);

    // Inside second clip.
    active = await getActiveGOs(page, sceneId, 30);
    expect(active, 'shape must be active at frame 30 (inside clip [25,35])').toContain(goId);

    // After last clip → invisible.
    active = await getActiveGOs(page, sceneId, 36);
    expect(active, 'shape must NOT be active at frame 36 (after all clips)').not.toContain(goId);
  });

  // ── Test 5: Overlap-merge preserves lifecycle ─────────────────────────────
  test('overlapping clips merged → single span covers correct lifecycle', async ({ page }) => {
    const layerId = await getDrawingLayerId(page);
    const sceneId = await getSceneId(page);

    const goId = await createGO(page, layerId, 'ShapeE', 0);

    // Two separate clips: [5, 20] and [15, 30].
    await mergeSpan(page, layerId, 5, 20);
    await mergeSpan(page, layerId, 15, 30); // overlaps → merged into [5, 30]

    // Verify kernel merged them.
    const clips = await page.evaluate((lid: string) => {
      const stub = (window as any).__kernel_stub__;
      return stub.getState().layers[lid]?.clips ?? [];
    }, layerId);
    expect(clips.length, 'two overlapping clips should have merged into one').toBe(1);
    expect(clips[0].startFrame, 'merged clip starts at 5').toBe(5);
    expect(clips[0].length, 'merged clip spans 5–30 (length 26)').toBe(26);

    // Lifecycle follows the merged span [5, 30].
    let active = await getActiveGOs(page, sceneId, 4);
    expect(active, 'frame 4: before merged span').not.toContain(goId);

    active = await getActiveGOs(page, sceneId, 17);
    expect(active, 'frame 17: inside merged span').toContain(goId);

    active = await getActiveGOs(page, sceneId, 31);
    expect(active, 'frame 31: after merged span').not.toContain(goId);
  });
});


