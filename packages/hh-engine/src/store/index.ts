// Export unified engine reducer for external consumption
export { engineReducer } from './store';
export type { EngineState } from './store';

// Also export individual reducers and actions for advanced use cases
export { default as sceneReducer } from './SceneSlice';
export { default as layerReducer } from './LayerSlice';
export { default as gameObjectReducer } from './GameObjectSlice';
export { default as componentReducer } from './ComponentSlice';
export { default as playbackReducer } from './PlaybackSlice';

// Export types
export type { ComponentSlice, ComponentState } from './ComponentSlice';
export type { GameObjectSlice, GameObjectState } from './GameObjectSlice';
export type { PlaybackState } from './PlaybackSlice';
export type { KeyFrameInfo, TimelineClip } from './LayerSlice';

// Export actions
export * from './SceneSlice';
export * from './LayerSlice';
export * from './GameObjectSlice';
export * from './ComponentSlice';
export * from './PlaybackSlice';

// Note: Host applications should use engineReducer for simplicity
// Individual reducers are exported for advanced scenarios only

