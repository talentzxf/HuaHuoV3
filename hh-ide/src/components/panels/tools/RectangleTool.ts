import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class RectangleTool extends BaseTool {
  name = 'rectangle';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    this.currentPath = new scope.Path.Rectangle({
      from: event.point,
      to: event.point,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (!this.currentPath || !this.startPoint) return;

    this.currentPath.remove();
    this.currentPath = new scope.Path.Rectangle({
      from: this.startPoint,
      to: event.point,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (this.currentPath) {
      console.log('Rectangle created:', this.currentPath);
    }
    this.cleanup();
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new RectangleTool('#1890ff'));

