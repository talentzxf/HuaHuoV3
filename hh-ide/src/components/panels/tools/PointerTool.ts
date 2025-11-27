import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class PointerTool extends BaseTool {
  name = 'pointer';
  private selectionRect: paper.Path.Rectangle | null = null;

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Store start point for drag selection
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

    // If clicked on an item, select it immediately
    if (hitResult && hitResult.item) {
      // Deselect all items in drawing layer only
      drawingLayer.children.forEach((item: any) => {
        item.selected = false;
      });

      hitResult.item.selected = true;
      console.log('Selected shape:', hitResult.item);
      this.startPoint = null; // Don't start drag selection
    }
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
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

    if (this.startPoint && this.selectionRect) {
      // Perform selection based on rectangle bounds
      const selectionBounds = this.selectionRect.bounds;

      // Deselect all first
      drawingLayer.children.forEach((item: any) => {
        item.selected = false;
      });

      // Select items that intersect with selection rectangle
      drawingLayer.children.forEach((item: any) => {
        if (item.bounds.intersects(selectionBounds)) {
          item.selected = true;
          console.log('Selected by drag:', item);
        }
      });

      // Remove selection rectangle
      this.selectionRect.remove();
      this.selectionRect = null;
    } else if (!this.startPoint) {
      // Single click without drag (clicked on background)
      // Already handled in onMouseDown - if no hit, nothing selected
    } else {
      // Single click on empty space - deselect all
      drawingLayer.children.forEach((item: any) => {
        item.selected = false;
      });
    }

    this.startPoint = null;
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new PointerTool('#1890ff'));

