// Core SDK
export { SDK } from './core/SDK';

// Scene API
export { SceneAPI } from './scene/SceneAPI';

// Editor API
export { EditorAPI, ICanvasTool, ToolRegistry } from './editor/EditorAPI';

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
  Renderer,
  CircleRenderer,
  RectangleRenderer,
  GameObject,
  Layer,
  Scene
} from '@huahuo/engine';

