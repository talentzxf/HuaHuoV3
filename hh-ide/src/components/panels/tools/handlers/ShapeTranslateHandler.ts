import { TransformHandlerBase } from './TransformHandlerBase';
import { getEngineStore } from '@huahuo/engine';
import { updateComponentProps } from '@huahuo/sdk';

/**
 * ShapeTranslateHandler
 * Handles translation (position) transformation of GameObjects
 */
export class ShapeTranslateHandler extends TransformHandlerBase {
  private initialPositions: Map<string, { x: number; y: number }> = new Map();
  private transformComponentIds: Map<string, string> = new Map(); // Cache component IDs
  private pendingUpdates: Map<string, { x: number; y: number }> = new Map();
  private rafId: number | null = null;

  protected onBeginMove(position: { x: number; y: number }): void {
    // Store initial positions of all target GameObjects
    this.initialPositions.clear();
    this.transformComponentIds.clear();

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

    console.debug('[ShapeTranslateHandler] Begin move, stored', this.initialPositions.size, 'initial positions');
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.startPosition) return;

    // Calculate delta from start position
    const deltaX = position.x - this.startPosition.x;
    const deltaY = position.y - this.startPosition.y;

    // Update pending positions (no Redux dispatch yet)
    this.targetGameObjects.forEach(gameObjectId => {
      const initialPos = this.initialPositions.get(gameObjectId);
      if (!initialPos) return;

      const newPosition = {
        x: initialPos.x + deltaX,
        y: initialPos.y + deltaY
      };

      this.pendingUpdates.set(gameObjectId, newPosition);
    });

    // Batch update using requestAnimationFrame
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(() => {
        this.flushUpdates();
        this.rafId = null;
      });
    }
  }

  private flushUpdates(): void {
    if (this.pendingUpdates.size === 0) return;

    const engineStore = getEngineStore();

    // Batch all updates
    this.pendingUpdates.forEach((newPosition, gameObjectId) => {
      const transformComponentId = this.transformComponentIds.get(gameObjectId);
      if (transformComponentId) {
        engineStore.dispatch(updateComponentProps({
          id: transformComponentId,
          patch: {
            position: newPosition
          }
        }));
      }
    });

    this.pendingUpdates.clear();
  }

  protected onEndMove(): void {
    console.debug('[ShapeTranslateHandler] End move');

    // Cancel any pending RAF
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    // Flush any remaining updates
    this.flushUpdates();

    // Clear caches
    this.initialPositions.clear();
    this.transformComponentIds.clear();
    this.pendingUpdates.clear();
  }
}

// Singleton instance
export const shapeTranslateHandler = new ShapeTranslateHandler();

