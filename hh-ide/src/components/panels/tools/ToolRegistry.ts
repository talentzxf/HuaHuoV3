import paper from 'paper';
import { ICanvasTool } from './BaseTool';

export class ToolRegistry {
  private tools: Map<string, ICanvasTool> = new Map();
  private currentToolName: string | null = null;

  register(tool: ICanvasTool): void {
    this.tools.set(tool.name, tool);
  }

  unregister(toolName: string): void {
    this.tools.delete(toolName);
  }

  setCurrentTool(toolName: string): void {
    if (this.tools.has(toolName)) {
      this.currentToolName = toolName;
    } else {
      console.warn(`Tool "${toolName}" not found in registry`);
    }
  }

  getCurrentTool(): ICanvasTool | null {
    if (!this.currentToolName) return null;
    return this.tools.get(this.currentToolName) || null;
  }

  handleMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
    const tool = this.getCurrentTool();
    if (tool && tool.onMouseDown) {
      tool.onMouseDown(event, scope);
    }
  }

  handleMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
    const tool = this.getCurrentTool();
    if (tool && tool.onMouseDrag) {
      tool.onMouseDrag(event, scope);
    }
  }

  handleMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
    const tool = this.getCurrentTool();
    if (tool && tool.onMouseUp) {
      tool.onMouseUp(event, scope);
    }
  }

  handleMouseMove(event: paper.ToolEvent, scope: paper.PaperScope): void {
    const tool = this.getCurrentTool();
    if (tool && tool.onMouseMove) {
      tool.onMouseMove(event, scope);
    }
  }

  getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }
}

