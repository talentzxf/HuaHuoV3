import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class PointerTool extends BaseTool {
  name = 'pointer';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Selection mode - only test hits on the drawing layer
    const drawingLayer = scope.project.layers.find((layer: any) => layer.name === 'drawing');

    if (!drawingLayer) return;

    const hitResult = drawingLayer.hitTest(event.point, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5
    });

    // Deselect all items in drawing layer only
    drawingLayer.children.forEach((item: any) => {
      item.selected = false;
    });

    if (hitResult && hitResult.item) {
      hitResult.item.selected = true;
      console.log('Selected shape:', hitResult.item);
    }
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new PointerTool('#1890ff'));

