import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class CircleTool extends BaseTool {
  name = 'circle';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    this.currentPath = new scope.Path.Circle({
      center: event.point,
      radius: 1,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (!this.currentPath || !this.startPoint) return;

    (this.currentPath as any).radius = this.startPoint.getDistance(event.point);
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (this.currentPath) {
      console.log('Circle created:', this.currentPath);
    }
    this.cleanup();
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new CircleTool('#1890ff'));

