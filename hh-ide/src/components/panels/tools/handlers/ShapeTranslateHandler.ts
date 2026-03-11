import { TransformHandlerBase } from './TransformHandlerBase';
import { getKernel } from '@huahuo/engine';

/**
 * ShapeTranslateHandler
 * Handles translation (position) transformation of GameObjects.
 * Reads/writes transform data via KernelBridge instead of Redux.
 */
export class ShapeTranslateHandler extends TransformHandlerBase {
  private initialPositions: Map<string, { x: number; y: number }> = new Map();
  // goId → transformComponentId (stored in Rust GO as component type "Transform")
  private currentPosition: { x: number; y: number } | null = null;

  protected onBeginMove(position: { x: number; y: number }): void {
    this.initialPositions.clear();
    this.currentPosition = position;

    const kernel = getKernel();
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;

    this.targetGameObjects.forEach(goId => {
      const props = kernel.getInterpolatedProps(goId, frame);
      const pos = props?.Transform?.position ?? { x: 0, y: 0 };
      this.initialPositions.set(goId, { x: pos.x, y: pos.y });
    });
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.startPosition) return;
    this.currentPosition = position;

    const deltaX = position.x - this.startPosition.x;
    const deltaY = position.y - this.startPosition.y;

    const kernel = getKernel();
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;

    this.targetGameObjects.forEach(goId => {
      const initialPos = this.initialPositions.get(goId);
      if (!initialPos) return;
      kernel.setKeyframe(goId, 'Transform', 'position', frame, {
        x: initialPos.x + deltaX,
        y: initialPos.y + deltaY,
      });
    });
  }

  protected onEndMove(): void {
    this.initialPositions.clear();
    this.currentPosition = null;
  }
}

// Singleton instance
export const shapeTranslateHandler = new ShapeTranslateHandler();

