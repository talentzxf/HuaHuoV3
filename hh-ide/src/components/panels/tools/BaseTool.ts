import paper from 'paper';

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

  protected cleanup() {
    this.currentPath = null;
    this.startPoint = null;
  }
}

