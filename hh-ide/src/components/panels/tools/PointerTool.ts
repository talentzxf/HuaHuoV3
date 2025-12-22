import paper from 'paper';
import { BaseTool } from './BaseTool';
import { store } from '../../../store/store';
import { selectObject, clearSelection } from '../../../store/features/selection/selectionSlice';
import { RotatableSelectionBox } from './RotatableSelectionBox';
import {
  shapeTranslateHandler,
  shapeRotateHandler,
  shapeScaleHandler,
  shapeHorizontalScaleHandler,
  shapeVerticalScaleHandler
} from './handlers';

export class PointerTool extends BaseTool {
  name = 'pointer';
  private selectionRect: paper.Path.Rectangle | null = null;
  private rotatableSelection: RotatableSelectionBox | null = null;
  private currentOperationType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag' | null = null;

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

    // ✅ FIRST: Check if clicked on selection box handles
    if (this.rotatableSelection) {
      const handleType = this.rotatableSelection.onMouseDown(event);
      if (handleType) {
        console.log('[PointerTool] Handle clicked:', handleType);
        this.currentOperationType = handleType;

        // Get gameObjectIds from selected items
        const gameObjectIds = new Set<string>();
        this.rotatableSelection.getSelectedItems().forEach(item => {
          if (item.data?.gameObjectId) {
            gameObjectIds.add(item.data.gameObjectId);
          }
        });

        // Start appropriate handler
        this.startHandler(handleType, gameObjectIds, event.point);

        this.startPoint = null;
        return;
      }
    }

    // THEN: Check if clicked on an object
    const hitResult = activeLayer.hitTest(event.point, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5
    });

    console.log('[PointerTool] HitTest result:', hitResult ? 'HIT' : 'MISS');

    // If clicked on an item, select it
    if (hitResult && hitResult.item) {
      console.log('[PointerTool] Hit item:', hitResult.item.name);

      // Skip selection box UI elements
      if (hitResult.item.data?.isSelectionBox) {
        console.log('[PointerTool] Item is selection box UI, skipping');
        return;
      }

      // Skip locked items
      if (hitResult.item.locked) {
        console.log('[PointerTool] Item is locked, skipping');
        return;
      }

      // Get GameObject ID
      const gameObjectId = hitResult.item.data?.gameObjectId;
      if (!gameObjectId) {
        console.warn('[PointerTool] Item has no gameObjectId');
        return;
      }

      // Initialize RotatableSelectionBox if not exists
      if (!this.rotatableSelection) {
        this.rotatableSelection = new RotatableSelectionBox();
      }

      // Disable Paper.js default selection
      activeLayer.children.forEach((item: any) => {
        item.selected = false;
      });

      // Dispatch Redux selection
      store.dispatch(selectObject({ type: 'gameObject', id: gameObjectId }));
      console.log('[PointerTool] Selected GameObject:', gameObjectId);

      // Show selection box
      this.rotatableSelection.setSelection([hitResult.item]);

      this.startPoint = null; // Don't start drag selection
    }
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // ✅ If we're in a transform operation, handle it
    if (this.currentOperationType && this.rotatableSelection) {
      const opType = this.rotatableSelection.onMouseDrag(event);

      if (opType) {
        // Call appropriate handler
        this.dragHandler(this.currentOperationType, event.point);

        // Refresh selection box
        this.rotatableSelection.refresh();
        return;
      }
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
    // ✅ Handle selection box mouse up
    if (this.rotatableSelection && this.currentOperationType) {
      const opType = this.rotatableSelection.onMouseUp(event);

      if (opType) {
        // End appropriate handler
        this.endHandler(opType);

        // Refresh selection box
        this.rotatableSelection.refresh();

        this.currentOperationType = null;
        this.startPoint = null;
        return;
      }
    }

    // Use the currently active layer
    const activeLayer = scope.project.activeLayer;
    if (!activeLayer) {
      console.warn('[PointerTool] No active layer in onMouseUp');
      return;
    }

    // Handle selection rectangle (drag selection)
    if (this.selectionRect) {
      const selectionBounds = this.selectionRect.bounds;

      // Find items that intersect with selection rectangle
      let selectedItem: paper.Item | null = null;
      let selectedGameObjectId: string | null = null;

      activeLayer.children.forEach((item: any) => {
        if (item.locked || item.data?.isSelectionBox) return;

        if (item.bounds.intersects(selectionBounds)) {
          if (!selectedItem && item.data?.gameObjectId) {
            selectedItem = item;
            selectedGameObjectId = item.data.gameObjectId;
          }
        }
      });

      // Dispatch selection
      if (selectedGameObjectId && selectedItem) {
        store.dispatch(selectObject({ type: 'gameObject', id: selectedGameObjectId }));

        if (!this.rotatableSelection) {
          this.rotatableSelection = new RotatableSelectionBox();
        }
        this.rotatableSelection.setSelection([selectedItem]);
      } else {
        store.dispatch(clearSelection());
        if (this.rotatableSelection) {
          this.rotatableSelection.clear();
        }
      }

      this.selectionRect.remove();
      this.selectionRect = null;
    } else if (this.startPoint) {
      // Single click on empty space
      store.dispatch(clearSelection());
      if (this.rotatableSelection) {
        this.rotatableSelection.clear();
      }
    }

    this.startPoint = null;
    this.currentOperationType = null;
  }

  /**
   * Start appropriate handler based on operation type
   */
  private startHandler(
    opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag',
    gameObjectIds: Set<string>,
    point: paper.Point
  ): void {
    const pos = { x: point.x, y: point.y };

    switch (opType) {
      case 'rotation':
        shapeRotateHandler.setTarget(gameObjectIds);
        shapeRotateHandler.beginMove(pos);
        break;

      case 'scale-corner':
        shapeScaleHandler.setTarget(gameObjectIds);
        shapeScaleHandler.beginMove(pos);
        break;

      case 'scale-edge-h':
        shapeHorizontalScaleHandler.setTarget(gameObjectIds);
        shapeHorizontalScaleHandler.beginMove(pos);
        break;

      case 'scale-edge-v':
        shapeVerticalScaleHandler.setTarget(gameObjectIds);
        shapeVerticalScaleHandler.beginMove(pos);
        break;

      case 'drag':
        // Use the gameObjectIds parameter passed in
        shapeTranslateHandler.setTarget(gameObjectIds);
        shapeTranslateHandler.beginMove(pos);
        break;
    }
  }

  /**
   * Drag appropriate handler
   */
  private dragHandler(
    opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag',
    point: paper.Point
  ): void {
    const pos = { x: point.x, y: point.y };

    switch (opType) {
      case 'rotation':
        shapeRotateHandler.dragging(pos);
        break;

      case 'scale-corner':
        shapeScaleHandler.dragging(pos);
        break;

      case 'scale-edge-h':
        shapeHorizontalScaleHandler.dragging(pos);
        break;

      case 'scale-edge-v':
        shapeVerticalScaleHandler.dragging(pos);
        break;

      case 'drag':
        shapeTranslateHandler.dragging(pos);
        break;
    }
  }

  /**
   * End appropriate handler
   */
  private endHandler(
    opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag'
  ): void {
    switch (opType) {
      case 'rotation':
        shapeRotateHandler.endMove();
        break;

      case 'scale-corner':
        shapeScaleHandler.endMove();
        break;

      case 'scale-edge-h':
        shapeHorizontalScaleHandler.endMove();
        break;

      case 'scale-edge-v':
        shapeVerticalScaleHandler.endMove();
        break;

      case 'drag':
        shapeTranslateHandler.endMove();
        break;
    }
  }
}

