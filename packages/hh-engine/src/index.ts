// Core interfaces
export * from './core/IComponent';
export * from './core/IGameObject';
export * from './core/ILayer';
export * from './core/IScene';
export { ComponentRegistry } from './core/ComponentRegistry';

// Renderer
export * from './renderer';

// Components
export { Component } from './components/Component';
export { Transform } from './components/Transform';
export { Visual } from './components/Visual';
export { registerBuiltInComponents } from './components/registerComponents';

// Scene system
export { GameObject } from './scene/GameObject';
export { Layer } from './scene/Layer';
export { Scene } from './scene/Scene';

// Engine
export { Engine } from './Engine';
export { getEngineStore, getEngineState } from './core/EngineGlobals';

// Redux Store - DO NOT export store instance, only reducers and types
export * from './store';
// Note: The store instance should NOT be exported
// Host applications should create their own store combining these reducers

