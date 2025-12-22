import { TransformHandlerBase } from './TransformHandlerBase';
import { getEngineStore } from '@huahuo/engine';
import { updateComponentPropsWithKeyFrame } from '@huahuo/sdk';

/**
 * ShapeScaleHandler
 * Handles uniform scaling transformation of GameObjects
 * Updates Redux store with keyframes during drag
 */
export class ShapeScaleHandler extends TransformHandlerBase {
  protected transformComponentIds: Map<string, string> = new Map(); // Cache component IDs
  protected originalScales: Map<string, { x: number; y: number }> = new Map(); // Store initial scales
  protected scaleCenter: { x: number; y: number } | null = null; // Scale center point

  protected onBeginMove(position: { x: number; y: number }): void {
    // Store initial scales of all target GameObjects
    this.originalScales.clear();
    this.transformComponentIds.clear();

    const engineStore = getEngineStore();
    const state = engineStore.getState();
    const engineState = state.engine || state;

    // Calculate scale center (center of all selected objects)
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    this.targetGameObjects.forEach(gameObjectId => {
      const gameObject = engineState.gameObjects.byId[gameObjectId];
      if (gameObject && gameObject.componentIds.length > 0) {
        // Find Transform component (should be first component)
        const transformComponentId = gameObject.componentIds[0];
        const transformComponent = engineState.components.byId[transformComponentId];

        if (transformComponent && transformComponent.type === 'Transform') {
          // Store initial scale
          const currentScale = transformComponent.props.scale;
          this.originalScales.set(gameObjectId, {
            x: currentScale.x,
            y: currentScale.y
          });
          // Cache the transform component ID
          this.transformComponentIds.set(gameObjectId, transformComponentId);

          // Accumulate position for center calculation
          const pos = transformComponent.props.position;
          sumX += pos.x;
          sumY += pos.y;
          count++;
        }
      }
    });

    // Calculate scale center as the average position of all objects
    if (count > 0) {
      this.scaleCenter = {
        x: sumX / count,
        y: sumY / count
      };
    } else {
      this.scaleCenter = position;
    }
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.scaleCenter || !this.startPosition) return;

    // Calculate scale factor based on distance from center
    const vec1 = {
      x: this.startPosition.x - this.scaleCenter.x,
      y: this.startPosition.y - this.scaleCenter.y
    };
    const vec2 = {
      x: position.x - this.scaleCenter.x,
      y: position.y - this.scaleCenter.y
    };

    const length1 = Math.sqrt(vec1.x * vec1.x + vec1.y * vec1.y);
    const length2 = Math.sqrt(vec2.x * vec2.x + vec2.y * vec2.y);

    // Avoid division by zero
    if (length1 < 0.001) return;

    const scaleFactor = length2 / length1;


    // Update Redux store with new scales and create keyframes
    this.targetGameObjects.forEach(gameObjectId => {
      const originalScale = this.originalScales.get(gameObjectId);
      const transformComponentId = this.transformComponentIds.get(gameObjectId);

      if (!originalScale || !transformComponentId) return;

      // Calculate new scale
      const newScale = this.calculateNewScale(originalScale, scaleFactor);

      const engineStore = getEngineStore();
      // Update scale and add keyframe automatically
      (engineStore.dispatch as any)(updateComponentPropsWithKeyFrame({
        id: transformComponentId,
        patch: {
          scale: newScale
        }
      }));
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
    return {
      x: originalScale.x * scaleFactor,
      y: originalScale.y * scaleFactor
    };
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
    return {
      x: originalScale.x * scaleFactor,
      y: originalScale.y // Keep y unchanged
    };
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
    return {
      x: originalScale.x, // Keep x unchanged
      y: originalScale.y * scaleFactor
    };
  }
}

// Singleton instances
export const shapeScaleHandler = new ShapeScaleHandler();
export const shapeHorizontalScaleHandler = new ShapeHorizontalScaleHandler();
export const shapeVerticalScaleHandler = new ShapeVerticalScaleHandler();

