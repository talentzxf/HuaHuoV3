import { TransformHandlerBase } from './TransformHandlerBase';
import { getKernel } from '@huahuo/engine';

/**
 * ShapeScaleHandler
 * Handles uniform scaling transformation of GameObjects.
 * Reads/writes transform data via KernelBridge instead of Redux.
 */
export class ShapeScaleHandler extends TransformHandlerBase {
  protected transformComponentIds: Map<string, string> = new Map();
  protected originalScales: Map<string, { x: number; y: number }> = new Map();
  protected scaleCenter: { x: number; y: number } | null = null;

  protected onBeginMove(position: { x: number; y: number }): void {
    // Store initial scales of all target GameObjects
    this.originalScales.clear();
    this.transformComponentIds.clear();

    const kernel = getKernel();
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;

    // Calculate scale center (center of all selected objects)
    let sumX = 0, sumY = 0, count = 0;

    this.targetGameObjects.forEach(goId => {
      const props = kernel.getInterpolatedProps(goId, frame);
      if (!props?.Transform) return;
      const scale = props.Transform.scale ?? { x: 1, y: 1 };
      const pos   = props.Transform.position ?? { x: 0, y: 0 };
      this.originalScales.set(goId, { x: scale.x, y: scale.y });
      this.transformComponentIds.set(goId, goId);
      sumX += pos.x; sumY += pos.y; count++;
    });

    // Calculate scale center as the average position of all objects
    this.scaleCenter = count > 0 ? { x: sumX / count, y: sumY / count } : position;
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.scaleCenter || !this.startPosition) return;

    // Calculate scale factor based on distance from center
    const vec1 = { x: this.startPosition.x - this.scaleCenter.x, y: this.startPosition.y - this.scaleCenter.y };
    const vec2 = { x: position.x - this.scaleCenter.x, y: position.y - this.scaleCenter.y };
    const length1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
    const length2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);
    // Avoid division by zero
    if (length1 < 0.001) return;
    const scaleFactor = length2 / length1;

    const kernel = getKernel();
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;

    // Update scale and add keyframe automatically
    this.targetGameObjects.forEach(goId => {
      const originalScale = this.originalScales.get(goId);
      if (!originalScale) return;
      // Calculate new scale
      const newScale = this.calculateNewScale(originalScale, scaleFactor);
      kernel.setKeyframe(goId, 'Transform', 'scale', frame, newScale);
    });
  }

  protected onEndMove(): void {
    // Clean up state
    this.originalScales.clear();
    this.transformComponentIds.clear();
    this.scaleCenter = null;
  }

  /**
   * Calculate new scale based on original scale and scale factor
   * Override this method in subclasses for horizontal/vertical only scaling
   */
  protected calculateNewScale(
    originalScale: { x: number; y: number },
    scaleFactor: number
  ): { x: number; y: number } {
    // Uniform scaling (both x and y)
    return { x: originalScale.x * scaleFactor, y: originalScale.y * scaleFactor };
  }
}

/**
 * ShapeHorizontalScaleHandler
 * Handles horizontal-only scaling transformation
 */
export class ShapeHorizontalScaleHandler extends ShapeScaleHandler {
  protected calculateNewScale(
    originalScale: { x: number; y: number },
    scaleFactor: number
  ): { x: number; y: number } {
    // Only scale horizontally (x-axis)
    return { x: originalScale.x * scaleFactor, y: originalScale.y }; // Keep y unchanged
  }
}

/**
 * ShapeVerticalScaleHandler
 * Handles vertical-only scaling transformation
 */
export class ShapeVerticalScaleHandler extends ShapeScaleHandler {
  protected calculateNewScale(
    originalScale: { x: number; y: number },
    scaleFactor: number
  ): { x: number; y: number } {
    // Only scale vertically (y-axis)
    return { x: originalScale.x, y: originalScale.y * scaleFactor }; // Keep x unchanged
  }
}

// Singleton instances
export const shapeScaleHandler = new ShapeScaleHandler();
export const shapeHorizontalScaleHandler = new ShapeHorizontalScaleHandler();
export const shapeVerticalScaleHandler = new ShapeVerticalScaleHandler();

