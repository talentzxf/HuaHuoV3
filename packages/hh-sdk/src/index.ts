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

export {
  Engine,
  Component,
  Transform,
  Visual,
  GameObject,
  Layer,
  Scene,
  // Export unified engine reducer (recommended)
  engineReducer,
  // Also export individual reducers for advanced use
  sceneReducer,
  layerReducer,
  gameObjectReducer,
  componentReducer,
  // Export engine globals for accessing store
  getEngineStore,
  getEngineState
} from '@huahuo/engine';

export type { EngineState, ComponentSlice, GameObjectSlice } from '@huahuo/engine';

