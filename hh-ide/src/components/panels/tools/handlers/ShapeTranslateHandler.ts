import { TransformHandlerBase } from './TransformHandlerBase';
import { getEngineStore } from '@huahuo/engine';
import { updateComponentPropsWithKeyFrame } from '@huahuo/sdk';

/**
 * ShapeTranslateHandler
 * Handles translation (position) transformation of GameObjects
 * Updates Redux store with keyframes during drag
 */
export class ShapeTranslateHandler extends TransformHandlerBase {
  private initialPositions: Map<string, { x: number; y: number }> = new Map();
  private transformComponentIds: Map<string, string> = new Map(); // Cache component IDs
  private currentPosition: { x: number; y: number } | null = null; // Track current position during drag

  protected onBeginMove(position: { x: number; y: number }): void {
    // Store initial positions of all target GameObjects
    this.initialPositions.clear();
    this.transformComponentIds.clear();

    // Initialize currentPosition to handle click without drag
    this.currentPosition = position;

    const engineStore = getEngineStore();
    const state = engineStore.getState();
    const engineState = state.engine || state;

    this.targetGameObjects.forEach(gameObjectId => {
      const gameObject = engineState.gameObjects.byId[gameObjectId];
      if (gameObject && gameObject.componentIds.length > 0) {
        // Find Transform component (should be first component)
        const transformComponentId = gameObject.componentIds[0];
        const transformComponent = engineState.components.byId[transformComponentId];

        if (transformComponent && transformComponent.type === 'Transform') {
          const currentPos = transformComponent.props.position;
          this.initialPositions.set(gameObjectId, {
            x: currentPos.x,
            y: currentPos.y
          });
          // Cache the transform component ID
          this.transformComponentIds.set(gameObjectId, transformComponentId);
        }
      }
    });
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.startPosition) return;

    // Track current position for final update
    this.currentPosition = position;

    // Calculate delta from start position
    const deltaX = position.x - this.startPosition.x;
    const deltaY = position.y - this.startPosition.y;

    // Update Redux store with new positions and create keyframes
    this.targetGameObjects.forEach(gameObjectId => {
      const initialPos = this.initialPositions.get(gameObjectId);
      const transformComponentId = this.transformComponentIds.get(gameObjectId);

      if (!initialPos || !transformComponentId) return;

      const newPosition = {
        x: initialPos.x + deltaX,
        y: initialPos.y + deltaY
      };

      const engineStore = getEngineStore();
      // Update position and add keyframe automatically
      (engineStore.dispatch as any)(updateComponentPropsWithKeyFrame({
        id: transformComponentId,
        patch: {
          position: newPosition
        }
      }));
    });
  }

  protected onEndMove(): void {
    if (!this.startPosition) return;

    // Calculate final delta
    const finalDeltaX = (this.currentPosition?.x || 0) - this.startPosition.x;
    const finalDeltaY = (this.currentPosition?.y || 0) - this.startPosition.y;

    // Update Redux store with final positions
    const engineStore = getEngineStore();

    this.targetGameObjects.forEach(gameObjectId => {
      const initialPos = this.initialPositions.get(gameObjectId);
      const transformComponentId = this.transformComponentIds.get(gameObjectId);

      if (!initialPos || !transformComponentId) return;

      const finalPosition = {
        x: initialPos.x + finalDeltaX,
        y: initialPos.y + finalDeltaY
      };

      // Update position and add keyframe automatically
      (engineStore.dispatch as any)(updateComponentPropsWithKeyFrame({
        id: transformComponentId,
        patch: {
          position: finalPosition
        }
      }));
    });

    // Clean up
    this.initialPositions.clear();
    this.transformComponentIds.clear();
    this.currentPosition = null;
  }
}

// Singleton instance
export const shapeTranslateHandler = new ShapeTranslateHandler();

