import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class CircleTool extends BaseTool {
  name = 'circle';

  // Generate random color
  private getRandomColor(scope: paper.PaperScope): paper.Color {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    return new scope.Color(r, g, b);
  }

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    const fillColor = this.getRandomColor(scope);
    this.currentPath = new scope.Path.Circle({
      center: event.point,
      radius: 1,
      fillColor: fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (!this.currentPath || !this.startPoint) return;

    const radius = this.startPoint.getDistance(event.point);
    const fillColor = this.currentPath.fillColor; // Keep the same color during drag

    // Remove old circle and create new one with updated radius
    this.currentPath.remove();
    this.currentPath = new scope.Path.Circle({
      center: this.startPoint,
      radius: radius,
      fillColor: fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
    });
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

