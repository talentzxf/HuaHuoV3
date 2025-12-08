import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@huahuo/sdk';
import { store } from '../../../store/store';
import { selectObject, clearSelection } from '../../../store/features/selection/selectionSlice';
import { TransformHandlerBase, TransformHandlerMap, shapeTranslateHandler } from './handlers/TransformHandlerMap';

export class PointerTool extends BaseTool {
  name = 'pointer';
  private selectionRect: paper.Path.Rectangle | null = null;
  private transformHandler: TransformHandlerBase | null = null;
  private transformHandlerMap: TransformHandlerMap = new TransformHandlerMap();

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Store start point
    this.startPoint = event.point.clone();

    // Use the currently active layer for hit testing
    const activeLayer = scope.project.activeLayer;
    if (!activeLayer) {
      console.warn('[PointerTool] No active layer');
      return;
    }

    console.log('[PointerTool] Mouse down at:', event.point.toString());
    console.log('[PointerTool] Active layer:', activeLayer.name || 'unnamed');
    console.log('[PointerTool] Active layer children count:', activeLayer.children.length);

    const hitResult = activeLayer.hitTest(event.point, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5
    });

    console.log('[PointerTool] HitTest result:', hitResult ? 'HIT' : 'MISS');

    // If clicked on an item, select it and prepare for transform
    if (hitResult && hitResult.item) {
      console.log('[PointerTool] Hit item:', hitResult.item.name, 'has gameObjectId:', !!hitResult.item.data?.gameObjectId);

      // Skip locked items
      if (hitResult.item.locked) {
        console.log('[PointerTool] Item is locked, skipping');
        return;
      }

      // Get GameObject ID from item.data
      const gameObjectId = hitResult.item.data?.gameObjectId;
      if (!gameObjectId) {
        console.warn('[PointerTool] Item has no gameObjectId');
        return;
      }

      // If not already selected, select it
      if (!hitResult.item.selected) {
        // Deselect all items in active layer
        activeLayer.children.forEach((item: any) => {
          item.selected = false;
        });

        hitResult.item.selected = true;
        store.dispatch(selectObject({ type: 'gameObject', id: gameObjectId }));
        console.log('[PointerTool] Selected GameObject:', gameObjectId);
      }

      // Set up transform handler based on hit type
      const hitType = hitResult.type;
      const handler = this.transformHandlerMap.getHandler(hitType);
      this.setTransformHandler(gameObjectId, event.point, handler);

      this.startPoint = null; // Don't start drag selection
    }
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // If transforming, delegate to handler
    if (this.transformHandler && this.transformHandler.getIsDragging()) {
      this.transformHandler.dragging({ x: event.point.x, y: event.point.y });
      return;
    }

    // Otherwise, draw selection rectangle
    if (!this.startPoint) return;

    // Remove previous selection rectangle
    if (this.selectionRect) {
      this.selectionRect.remove();
    }

    // Create selection rectangle from start point to current point
    const rect = new scope.Rectangle(this.startPoint, event.point);
    this.selectionRect = new scope.Path.Rectangle(rect);
    this.selectionRect.strokeColor = new scope.Color('#1890ff');
    this.selectionRect.strokeWidth = 1;
    this.selectionRect.dashArray = [4, 4]; // Dashed line
    this.selectionRect.fillColor = new scope.Color(0.11, 0.56, 1, 0.1); // Semi-transparent blue
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Use the currently active layer
    const activeLayer = scope.project.activeLayer;
    if (!activeLayer) {
      console.warn('[PointerTool] No active layer in onMouseUp');
      return;
    }

    // If was transforming, end the transformation
    if (this.transformHandler) {
      this.transformHandler.endMove();
      this.transformHandler = null;
      this.startPoint = null;
      return;
    }

    // Handle selection rectangle (drag selection)
    if (this.selectionRect) {
      // Perform selection based on rectangle bounds
      const selectionBounds = this.selectionRect.bounds;

      // Deselect all first
      activeLayer.children.forEach((item: any) => {
        item.selected = false;
      });

      // Select items that intersect with selection rectangle
      let selectedGameObjectId: string | null = null;

      activeLayer.children.forEach((item: any) => {
        // Skip locked items (like whiteCanvas)
        if (item.locked) return;

        if (item.bounds.intersects(selectionBounds)) {
          item.selected = true;

          // Get GameObject ID from item.data (only first selected item)
          if (!selectedGameObjectId && item.data?.gameObjectId) {
            selectedGameObjectId = item.data.gameObjectId;
            console.log('[PointerTool] Selected GameObject by drag:', selectedGameObjectId);
          }
        }
      });

      // Dispatch selection (or clear if nothing selected)
      store.dispatch(selectedGameObjectId ? selectObject({ type: 'gameObject', id: selectedGameObjectId }) : clearSelection());

      // IMPORTANT: Always remove selection rectangle after use
      this.selectionRect.remove();
      this.selectionRect = null;
    } else if (this.startPoint) {
      // Single click on empty space (no selection rect was created because no drag)
      // Deselect all
      activeLayer.children.forEach((item: any) => {
        item.selected = false;
      });
      store.dispatch(clearSelection());
    }

    // Always reset startPoint
    this.startPoint = null;
  }

  /**
   * Set up transform handler for GameObject
   */
  private setTransformHandler(
    gameObjectId: string,
    position: paper.Point,
    handler: TransformHandlerBase = shapeTranslateHandler
  ): void {
    this.transformHandler = handler;

    // Set target GameObject
    this.transformHandler.setTarget(gameObjectId);

    // Begin transformation
    this.transformHandler.beginMove({ x: position.x, y: position.y });
  }
}

