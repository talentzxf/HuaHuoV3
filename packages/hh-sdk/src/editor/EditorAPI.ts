import paper from 'paper';

export interface ICanvasTool {
  name: string;
  onMouseDown?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseDrag?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseUp?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
  onMouseMove?: (event: paper.ToolEvent, scope: paper.PaperScope) => void;
}

export class ToolRegistry {
  private tools = new Map<string, ICanvasTool>();
  private currentTool: string | null = null;

  register(tool: ICanvasTool): void {
    this.tools.set(tool.name, tool);
  }

  setCurrentTool(toolName: string): void {
    if (this.tools.has(toolName)) {
      this.currentTool = toolName;
    }
  }

  getCurrentTool(): ICanvasTool | null {
    if (!this.currentTool) return null;
    return this.tools.get(this.currentTool) || null;
  }

  hasTool(toolName: string): boolean {
    return this.tools.has(toolName);
  }

  getAllToolNames(): string[] {
    return Array.from(this.tools.keys());
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
}

export class EditorAPI {
  private toolRegistry: ToolRegistry;

  constructor() {
    this.toolRegistry = new ToolRegistry();
  }

  /**
   * Get the tool registry for internal use
   */
  getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  /**
   * Register a tool to the canvas editor
   */
  registerTool(tool: ICanvasTool): void {
    this.toolRegistry.register(tool);
  }

  /**
   * Set the current active tool
   */
  setCurrentTool(toolName: string): void {
    this.toolRegistry.setCurrentTool(toolName);
  }

  /**
   * Get the current active tool
   */
  getCurrentTool(): ICanvasTool | null {
    return this.toolRegistry.getCurrentTool();
  }

  /**
   * Check if a tool is registered
   */
  hasTool(toolName: string): boolean {
    return this.toolRegistry.hasTool(toolName);
  }

  /**
   * Get all registered tool names
   */
  getAllToolNames(): string[] {
    return this.toolRegistry.getAllToolNames();
  }
}

