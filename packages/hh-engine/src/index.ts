// Core interfaces
export * from './core/IComponent';
export * from './core/IGameObject';
export * from './core/ILayer';
export * from './core/IScene';

// Core registries and types
export { ComponentRegistry } from './core/ComponentRegistry';
export { InstanceRegistry } from './core/InstanceRegistry';
export { EasingType } from './core/EasingTypes';
export { ComponentPropertyRendererRegistry } from './core/PropertyRendererRegistry';
export type { PropertyRendererFunction } from './core/PropertyRendererRegistry';

// Kernel Bridge (data layer — replaces Redux engine slices)
export { KernelBridge, getKernel } from './core/KernelBridge';
export type { HhEvent, HhEventCategory, KernelCommandResult, KernelQueryResult } from './core/KernelBridge';

// Renderer
export * from './renderer';
export { KernelAdapter } from './renderer/KernelAdapter';

// Components
export { ComponentBase } from './components/ComponentBase';
export { Transform } from './components/Transform';
export { Visual } from './components/Visual';
export { TimelineComponent } from './components/TimelineComponent';
export type { AnimationSegment } from './components/TimelineComponent';
export { registerBuiltInComponents } from './components/registerComponents';

// Scene system
export { GameObject } from './scene/GameObject';
export { Layer } from './scene/Layer';
export { Scene } from './scene/Scene';

// Engine
export { Engine } from './Engine';

// Legacy compat shims (deprecated — will be removed after full migration)
export { getEngineStore, getEngineState, initEngineStore } from './core/EngineGlobals';
export { getAnimationPlayer } from './core/AnimationPlayer';

// NOTE: Redux engine slices are intentionally NOT re-exported.
// All data now lives in the Rust kernel (KernelBridge / KernelAPI WASM).
// If you need to read engine data, use getKernel().getProject() / .getCurrentScene() etc.
// If you need to write, use getKernel().dispatch({ ... }) or the convenience helpers.
