/**
 * Base class for transform handlers (translate, rotate, scale, etc.)
 * Handles transformation of GameObjects in the scene
 */
export abstract class TransformHandlerBase {
  protected targetGameObjects: Set<string> = new Set();
  protected isDragging = false;
  protected startPosition: { x: number; y: number } | null = null;

  /**
   * Set target GameObjects to transform
   */
  setTarget(gameObjectIds: Set<string> | string): void {
    this.targetGameObjects.clear();
    if (gameObjectIds instanceof Set) {
      gameObjectIds.forEach(id => this.targetGameObjects.add(id));
    } else {
      this.targetGameObjects.add(gameObjectIds);
    }
  }

  /**
   * Begin transformation
   */
  beginMove(position: { x: number; y: number }): void {
    this.startPosition = { ...position };
    this.isDragging = true;
    this.onBeginMove(position);
  }

  /**
   * During transformation (dragging)
   */
  dragging(position: { x: number; y: number }): void {
    if (!this.isDragging || !this.startPosition) return;
    this.onDragging(position);
  }

  /**
   * End transformation
   */
  endMove(): void {
    if (!this.isDragging) return; // Already ended, prevent duplicate calls

    this.isDragging = false;
    this.onEndMove();

    // ✅ Clean up state to prevent stale data
    this.startPosition = null;
    this.targetGameObjects.clear();
  }

  /**
   * Get dragging state
   */
  getIsDragging(): boolean {
    return this.isDragging;
  }

  /**
   * Abstract methods to be implemented by subclasses
   */
  protected abstract onBeginMove(position: { x: number; y: number }): void;
  protected abstract onDragging(position: { x: number; y: number }): void;
  protected abstract onEndMove(): void;
}

