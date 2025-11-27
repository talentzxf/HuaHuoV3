import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class PointerTool extends BaseTool {
  name = 'pointer';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    // Selection mode
    const hitResult = scope.project.hitTest(event.point, {
      segments: true,
      stroke: true,
      fill: true,
      tolerance: 5
    });

    // Deselect all
    scope.project.activeLayer.children.forEach((item: any) => {
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

