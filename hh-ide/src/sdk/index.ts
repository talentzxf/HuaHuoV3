import { ToolRegistry } from '@/components/panels/tools/ToolRegistry';

// SDK namespace
export namespace SDK {
  export namespace Editor {
    export namespace Tools {
      // Internal registry instance
      const registry = new ToolRegistry();

      /**
       * Register a tool to the canvas editor
       * @param tool - Tool instance implementing ICanvasTool interface
       */
      export function register(tool: any): void {
        registry.register(tool);
      }

      /**
       * Set the current active tool
       * @param toolName - Name of the tool to activate
       */
      export function setCurrentTool(toolName: string): void {
        registry.setCurrentTool(toolName);
      }

      /**
       * Get the internal registry (for Canvas SDK internal use)
       * @internal
       */
      export function getRegistry(): ToolRegistry {
        return registry;
      }

      /**
       * Check if a tool is registered
       * @param toolName - Name of the tool to check
       */
      export function hasTool(toolName: string): boolean {
        return registry.hasTool(toolName);
      }

      /**
       * Get all registered tool names
       */
      export function getAllToolNames(): string[] {
        return registry.getAllToolNames();
      }
    }
  }
}

// Export types for external use
export type { ICanvasTool } from '@/components/panels/tools/BaseTool';
export { BaseTool } from '@/components/panels/tools/BaseTool';
export { ToolRegistry } from '@/components/panels/tools/ToolRegistry';

