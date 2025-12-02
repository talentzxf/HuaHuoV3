import paper from 'paper';
import { BaseTool } from './BaseTool';

export class RectangleTool extends BaseTool {
  name = 'rectangle';
  private fillColor: paper.Color | null = null;

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    this.fillColor = this.getRandomColor(scope);
    this.currentPath = new scope.Path.Rectangle({
      from: event.point,
      to: event.point,
      fillColor: this.fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
      name: this.name,
    });
  }

  onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (!this.currentPath || !this.startPoint || !this.fillColor) return;

    this.currentPath.remove();
    this.currentPath = new scope.Path.Rectangle({
      from: this.startPoint,
      to: event.point,
      fillColor: this.fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
      name: this.name,
    });
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.createGameObjectAndSelect();
    this.fillColor = null;
    this.cleanup();
  }
}

