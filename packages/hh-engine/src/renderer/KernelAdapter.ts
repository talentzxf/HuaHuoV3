import { KernelBridge } from '../core/KernelBridge';
import { IRenderer } from './IRenderer';

/**
 * KernelAdapter — event-driven bridge from KernelBridge → Paper.js renderer.
 *
 * Replaces ReduxAdapter. Instead of diffing Redux state trees, it subscribes
 * to typed events from the Rust kernel and reacts only to what changed.
 */
export class KernelAdapter {
  private renderer: IRenderer;
  private kernel: KernelBridge;
  private subIds: number[] = [];

  constructor(renderer: IRenderer, kernel: KernelBridge) {
    this.renderer = renderer;
    this.kernel = kernel;
  }

  startListening(): void {
    // ── GO lifecycle ──────────────────────────────────────────────────────
    this.subIds.push(
      this.kernel.subscribe('go', (ev) => {
        switch (ev.GameObject?.kind ?? ev.kind) {
          case 'deleted':
            this.handleGoRemoved(ev.go_id ?? ev.GameObject?.go_id);
            break;
          case 'active_changed':
            this.handleGoActiveChanged(
              ev.go_id ?? ev.GameObject?.go_id,
              ev.active ?? ev.GameObject?.active
            );
            break;
        }
        this.renderer.render();
      })
    );

    // ── Component property / keyframe changes → re-interpolate & redraw ──
    this.subIds.push(
      this.kernel.subscribe('keyframe', (ev) => {
        const goId = ev.go_id ?? ev.Keyframe?.go_id;
        const frame = this.kernel.getPlaybackState()?.current_frame ?? 0;
        if (goId) this.applyInterpolatedProps(goId, frame);
        this.renderer.render();
      })
    );

    // ── Playback frame change → update all active GOs ────────────────────
    this.subIds.push(
      this.kernel.subscribe('playback/frame_changed', (ev) => {
        const frame = ev.frame ?? ev.Playback?.frame ?? 0;
        this.updateAllActiveGameObjects(frame);
        this.renderer.render();
      })
    );

    this.subIds.push(
      this.kernel.subscribe('playback/looped_back', (ev) => {
        const frame = ev.frame ?? ev.Playback?.frame ?? 0;
        this.updateAllActiveGameObjects(frame);
        this.renderer.render();
      })
    );

    // ── Scene changes → rebuild Paper layers ─────────────────────────────
    this.subIds.push(
      this.kernel.subscribe('layer', (ev) => {
        // Layer visibility / lock handled separately if needed
        this.renderer.render();
      })
    );
  }

  stopListening(): void {
    for (const id of this.subIds) {
      this.kernel.unsubscribe(id);
    }
    this.subIds = [];
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  private handleGoRemoved(goId: string | undefined): void {
    if (!goId) return;
    const renderItem = (this.renderer as any).getRenderItem?.(goId);
    if (!renderItem) return;
    if (renderItem.remove) renderItem.remove();
    if ((this.renderer as any).unregisterRenderItem) {
      (this.renderer as any).unregisterRenderItem(goId);
    }
  }

  private handleGoActiveChanged(goId: string | undefined, active?: boolean): void {
    if (!goId) return;
    const renderItem = (this.renderer as any).getRenderItem?.(goId);
    if (!renderItem) return;
    if (!active && renderItem.selected) renderItem.selected = false;
    if (renderItem.visible !== undefined) renderItem.visible = active ?? true;
  }

  /** Re-interpolate a single GO and push the result to Paper.js */
  applyInterpolatedProps(goId: string, frame: number): void {
    const props = this.kernel.getInterpolatedProps(goId, frame);
    if (!props) return;

    const renderItem = (this.renderer as any).getRenderItem?.(goId);
    if (!renderItem) return;

    // Transform
    if (props.Transform) {
      const t = props.Transform;
      if (this.renderer.updateItemTransform) {
        this.renderer.updateItemTransform(renderItem, {
          position: t.position ?? { x: 0, y: 0 },
          rotation: t.rotation ?? 0,
          scale: t.scale ?? { x: 1, y: 1 },
        });
      }
    }

    // Visual
    if (props.Visual && this.renderer.updateItemVisual) {
      this.renderer.updateItemVisual(renderItem, props.Visual);
    }
  }

  /** Update visibility + props for all GOs in the current scene at `frame` */
  private updateAllActiveGameObjects(frame: number): void {
    const scene = this.kernel.getCurrentScene();
    if (!scene) return;

    const allGoIds = Object.keys(scene.game_objects ?? {});
    for (const goId of allGoIds) {
      const go = scene.game_objects[goId];
      if (!go) continue;

      // Born-frame visibility
      const shouldBeVisible = go.active && go.born_frame_id <= frame;
      const renderItem = (this.renderer as any).getRenderItem?.(goId);
      if (renderItem && renderItem.visible !== undefined) {
        renderItem.visible = shouldBeVisible;
      }

      if (shouldBeVisible) {
        this.applyInterpolatedProps(goId, frame);
      }
    }
  }
}

