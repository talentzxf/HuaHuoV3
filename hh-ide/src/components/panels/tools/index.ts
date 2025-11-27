// Export base classes for external extension
export type { ICanvasTool } from './BaseTool';
export { BaseTool } from './BaseTool';
export { ToolRegistry } from './ToolRegistry';

// Import tools to trigger auto-registration
// These imports cause the tools to register themselves
import './PointerTool';
import './CircleTool';
import './RectangleTool';
import './LineTool';

// Re-export tool classes for external extension
export { PointerTool } from './PointerTool';
export { CircleTool } from './CircleTool';
export { RectangleTool } from './RectangleTool';
export { LineTool } from './LineTool';

