import { ToolRegistry } from '@/components/panels/tools/ToolRegistry';
import { Engine, IScene, IGameObject } from '@huahuo/engine';
import paper from 'paper';

// SDK namespace
export namespace SDK {
  // Scene management
  export namespace Scene {
    let engineInstance: Engine | null = null;

    /**
     * Initialize the scene engine
     * @internal
     */
    export function initialize(scope: paper.PaperScope): void {
      engineInstance = new Engine(scope);
    }

    /**
     * Get the engine instance
     * @internal
     */
    export function getEngine(): Engine {
      if (!engineInstance) {
        throw new Error('Scene engine not initialized');
      }
      return engineInstance;
    }

    /**
     * Create a new scene
     */
    export function createScene(name: string): IScene {
      return getEngine().createScene(name);
    }

    /**
     * Get the current active scene
     */
    export function getCurrentScene(): IScene | null {
      return getEngine().getCurrentScene();
    }

    /**
     * Load a scene from JSON data
     */
    export function loadScene(sceneData: any): IScene {
      return getEngine().loadScene(sceneData);
    }

    /**
     * Save the current scene to JSON
     */
    export function saveScene(): any {
      return getEngine().saveScene();
    }

    /**
     * Create a GameObject from a Paper.js item
     */
    export function createGameObjectFromPaperItem(item: paper.Item, layerName?: string): IGameObject | null {
      return getEngine().createGameObjectFromPaperItem(item, layerName);
    }

    /**
     * Register a custom component type
     */
    export function registerComponent(componentType: string, factory: any): void {
      getEngine().registerComponent(componentType, factory);
    }
  }

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

