import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class LineTool extends BaseTool {
  name = 'line';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    this.currentPath = new scope.Path.Line({
      from: event.point,
      to: event.point,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (!this.currentPath || !this.startPoint) return;

    this.currentPath.segments[1].point = event.point;
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (this.currentPath) {
      console.log('Line created:', this.currentPath);
    }
    this.cleanup();
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new LineTool('#1890ff'));

