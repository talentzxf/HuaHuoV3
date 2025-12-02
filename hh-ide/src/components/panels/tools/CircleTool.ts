import paper from 'paper';
import { BaseTool } from './BaseTool';

export class CircleTool extends BaseTool {
  name = 'circle';

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    const fillColor = this.getRandomColor(scope);
    this.currentPath = new scope.Path.Circle({
      center: event.point,
      radius: 1,
      fillColor: fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
      name: this.name,
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
      name: this.name,
    });
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.createGameObjectAndSelect();
    this.cleanup();
  }
}


