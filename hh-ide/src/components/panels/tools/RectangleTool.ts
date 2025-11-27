import paper from 'paper';
import { BaseTool } from './BaseTool';
import { SDK } from '@/sdk';

export class RectangleTool extends BaseTool {
  name = 'rectangle';
  private fillColor: paper.Color | null = null;

  // Generate random color
  private getRandomColor(scope: paper.PaperScope): paper.Color {
    const r = Math.random();
    const g = Math.random();
    const b = Math.random();
    return new scope.Color(r, g, b);
  }

  onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    this.startPoint = event.point;
    this.fillColor = this.getRandomColor(scope);
    this.currentPath = new scope.Path.Rectangle({
      from: event.point,
      to: event.point,
      fillColor: this.fillColor,
      strokeColor: new scope.Color(this.color),
      strokeWidth: 2,
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
    });
  }

  onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    if (this.currentPath) {
      console.log('Rectangle created:', this.currentPath);

      // Create GameObject from Paper.js item
      const gameObject = SDK.Scene.createGameObjectFromPaperItem(this.currentPath, 'drawing');
      if (gameObject) {
        console.log('GameObject created:', gameObject);
      }

      // Remove the original Paper.js path since it's now managed by the GameObject
      this.currentPath.remove();
    }
    this.fillColor = null;
    this.cleanup();
  }
}

// Auto-register this tool
SDK.Editor.Tools.register(new RectangleTool('#1890ff'));

