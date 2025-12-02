import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@huahuo/sdk';
import { store } from '../../../store/store';
import { selectGameObject } from '../../../store/features/selection/selectionSlice';
import { TransformHandlerBase, TransformHandlerMap, shapeTranslateHandler } from './handlers/TransformHandlerMap';

export class PointerTool extends BaseTool {
  name = 'pointer';
  private selectionRect: paper.Path.Rectangle | null = null;
  private transformHandler: TransformHandlerBase | null = null;
  private transformHandlerMap: TransformHandlerMap = new TransformHandlerMap();

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Store start point
    this.startPoint = event.point.clone();

    // Selection mode - only test hits on the drawing layer
    const drawingLayer = scope.project.layers.find((layer: any) => layer.name === 'drawing');
    if (!drawingLayer) return;

    const hitResult = drawingLayer.hitTest(event.point, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5
    });

    // If clicked on an item, select it and prepare for transform
    if (hitResult && hitResult.item) {
      // Get GameObject ID from item.data
      const gameObjectId = hitResult.item.data?.gameObjectId;
      if (!gameObjectId) return;

      // If not already selected, select it
      if (!hitResult.item.selected) {
        // Deselect all items
        drawingLayer.children.forEach((item: any) => {
          item.selected = false;
        });

        hitResult.item.selected = true;
        store.dispatch(selectGameObject(gameObjectId));
        console.log('Selected GameObject:', gameObjectId);
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
    const drawingLayer = scope.project.layers.find((layer: any) => layer.name === 'drawing');
    if (!drawingLayer) return;

    // If was transforming, end the transformation
    if (this.transformHandler) {
      this.transformHandler.endMove();
      this.transformHandler = null;
      return;
    }

    // Handle selection rectangle
    if (this.startPoint && this.selectionRect) {
      // Perform selection based on rectangle bounds
      const selectionBounds = this.selectionRect.bounds;

      // Deselect all first
      drawingLayer.children.forEach((item: any) => {
        item.selected = false;
      });

      // Select items that intersect with selection rectangle
      let selectedGameObjectId: string | null = null;

      drawingLayer.children.forEach((item: any) => {
        if (item.bounds.intersects(selectionBounds)) {
          item.selected = true;

          // Get GameObject ID from item.data (only first selected item)
          if (!selectedGameObjectId && item.data?.gameObjectId) {
            selectedGameObjectId = item.data.gameObjectId;
            console.log('Selected GameObject by drag:', selectedGameObjectId);
          }
        }
      });

      // Dispatch selection (or clear if nothing selected)
      store.dispatch(selectGameObject(selectedGameObjectId));

      // Remove selection rectangle
      this.selectionRect.remove();
      this.selectionRect = null;
    } else if (!this.startPoint) {
      // Single click without drag (already handled in onMouseDown)
    } else {
      // Single click on empty space - deselect all
      drawingLayer.children.forEach((item: any) => {
        item.selected = false;
      });
      store.dispatch(selectGameObject(null));
    }

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

