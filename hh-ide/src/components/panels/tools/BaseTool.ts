import paper from 'paper';
import { SDK } from '@huahuo/sdk';
import { store } from '../../../store/store';
import { selectGameObject } from '../../../store/features/selection/selectionSlice';

export interface ICanvasTool {
  name: string;
  onMouseDown?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseDrag?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseUp?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseMove?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
}

export abstract class BaseTool implements ICanvasTool {
  abstract name: string;
  protected currentPath: paper.Path | null = null;
  protected startPoint: paper.Point | null = null;
  protected color: string;

  constructor(color: string = '#1890ff') {
    this.color = color;
  }

  onMouseDown?(event: paper.ToolEvent, scope: paper.PaperScope): void;
  onMouseDrag?(event: paper.ToolEvent, scope: paper.PaperScope): void;
  onMouseUp?(event: paper.ToolEvent, scope: paper.PaperScope): void;
  onMouseMove?(event: paper.ToolEvent, scope: paper.PaperScope): void;

  /**
   * Create GameObject from current path and auto-select it
   * Common logic for all drawing tools
   */
  protected createGameObjectAndSelect(): void {
    if (!this.currentPath) return;

    console.log(`${this.name} created:`, this.currentPath);

    // Create GameObject from Paper.js item
    const gameObject = SDK.instance.Scene.createGameObjectFromPaperItem(this.currentPath, 'drawing');
    if (gameObject) {
      console.log('GameObject created:', gameObject);

      // Auto-select the newly created GameObject
      store.dispatch(selectGameObject(gameObject.id));
    }
  }

  protected cleanup() {
    this.currentPath = null;
    this.startPoint = null;
  }

  protected getRandomColor(scope: paper.PaperScope): paper.Color {
    return new scope.Color({
      hue: Math.random() * 360,
      saturation: 0.7,
      brightness: 0.8,
    });
  }
}

