// Core SDK
export { SDK } from './core/SDK';

// Scene API
export { SceneAPI } from './scene/SceneAPI';

// Editor API
export type { ICanvasTool } from './editor/EditorAPI';
export { EditorAPI, ToolRegistry } from './editor/EditorAPI';

// Re-export Engine interfaces for convenience
export type {
  IScene,
  ILayer,
  IGameObject,
  IComponent,
  ITransform,
  IRenderer
} from '@huahuo/engine';

// Re-export Engine core classes and utilities
export {
  Engine,
  ComponentBase,
  Transform,
  Visual,
  GameObject,
  Layer,
  Scene,
  ComponentRegistry,
  InstanceRegistry,
  getEngineStore,
  getEngineState
} from '@huahuo/engine';

// Re-export all store-related items (reducers, actions, types)
export * from '@huahuo/engine/src/store';

