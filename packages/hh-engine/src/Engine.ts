import { IScene } from './core/IScene';
import { IGameObject } from './core/IGameObject';
import { Scene } from './scene/Scene';
import { IRenderer, PaperRenderer, ReduxRenderer } from './renderer';
import { ComponentRegistry } from './core/ComponentRegistry';
import { registerBuiltInComponents } from './components/registerComponents';
import type { Store } from '@reduxjs/toolkit';
import type { EngineState } from './store/store';

// Global store reference and selector for Engine internals to access
let globalStore: Store | null = null;
let engineStateSelector: ((state: any) => EngineState) | null = null;

export function getEngineStore(): Store {
  if (!globalStore) {
    throw new Error('Engine store not initialized. Make sure Engine is constructed with a store.');
  }
  return globalStore;
}

export function getEngineState(): EngineState {
  if (!globalStore || !engineStateSelector) {
    throw new Error('Engine not initialized properly.');
  }
  return engineStateSelector(globalStore.getState());
}

export class Engine {
  private currentScene: Scene | null = null;
  private renderer: IRenderer;
  private reduxRenderer: ReduxRenderer;
  private sceneContext: any;

  constructor(
    canvas: HTMLCanvasElement,
    store: Store,
    selectEngineState: (state: any) => EngineState,
    renderer?: IRenderer
  ) {
    // Set global store reference and selector so other Engine classes can access it
    globalStore = store;
    engineStateSelector = selectEngineState;

    this.renderer = renderer || new PaperRenderer();
    this.renderer.initialize(canvas);
    this.sceneContext = this.renderer.createSceneContext();

    // Setup Redux-aware renderer
    this.reduxRenderer = new ReduxRenderer(this.renderer, store);
    this.reduxRenderer.startListening();

    // Register built-in components
    registerBuiltInComponents(this.renderer);
  }

  registerComponent(componentType: string, factory: any): void {
    ComponentRegistry.getInstance().register(componentType, factory);
  }

  createScene(name: string): IScene {
    this.currentScene = Scene.create(name, this.renderer, this.sceneContext);
    return this.currentScene;
  }

  getCurrentScene(): IScene | null {
    return this.currentScene;
  }

  loadScene(sceneData: any): IScene {
    // TODO: Implement scene loading with renderer
    throw new Error("loadScene not implemented yet");
  }

  saveScene(): any {
    // TODO: Implement scene serialization
    return null;
  }

  createGameObjectFromPaperItem(item: any, layerName?: string): IGameObject | null {
    if (!this.currentScene) {
      console.warn('No active scene');
      return null;
    }

    // Get or create layer
    let layer = layerName
      ? this.currentScene.getLayerByName(layerName)
      : this.currentScene.layers[0];

    if (!layer && layerName) {
      layer = this.currentScene.addLayer(layerName);
    }

    if (!layer) {
      console.warn('No layer available');
      return null;
    }

    // Create GameObject with the Paper.js item as renderItem
    // This ensures the renderItem is cached in the Layer
    const gameObject = layer.addGameObject(item.name || 'GameObject', item);

    // Set Transform
    gameObject.transform.position = { x: item.position.x, y: item.position.y };
    gameObject.transform.rotation = item.rotation || 0;

    // Detect item type and add appropriate renderer component
    // Check for circle (has radius property or is a circle path)
    if (item.className === 'Path' && item.segments && item.segments.length > 0) {
      // Check if it's a circle by checking if all points are equidistant from center
      const bounds = item.bounds;
      const width = bounds.width;
      const height = bounds.height;

      // If width and height are similar and has few segments, it's likely a circle
      if (Math.abs(width - height) < 1 && item.segments.length <= 4) {
        gameObject.addComponent('CircleRenderer', {
          radius: width / 2,
          fillColor: item.fillColor ? this.colorToCSS(item.fillColor) : undefined,
          strokeColor: item.strokeColor ? this.colorToCSS(item.strokeColor) : undefined,
          strokeWidth: item.strokeWidth || 1,
        });
      } else {
        // It's a rectangle or other shape
        gameObject.addComponent('RectangleRenderer', {
          width: width,
          height: height,
          fillColor: item.fillColor ? this.colorToCSS(item.fillColor) : undefined,
          strokeColor: item.strokeColor ? this.colorToCSS(item.strokeColor) : undefined,
          strokeWidth: item.strokeWidth || 1,
        });
      }
    }

    return gameObject;
  }

  private colorToCSS(color: any): string {
    if (!color) return '#000000';
    if (typeof color.toCSS === 'function') {
      return color.toCSS(true);
    }
    // Fallback for color objects
    if (color.red !== undefined && color.green !== undefined && color.blue !== undefined) {
      const r = Math.round(color.red * 255);
      const g = Math.round(color.green * 255);
      const b = Math.round(color.blue * 255);
      const a = color.alpha !== undefined ? color.alpha : 1;
      if (a < 1) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
      return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    }
    return '#000000';
  }

  update(deltaTime: number): void {
    this.currentScene?.update(deltaTime);
  }

  dispose(): void {
    this.reduxRenderer.stopListening();
    this.renderer.dispose();
  }

  getRenderer(): IRenderer {
    return this.renderer;
  }

  getSceneContext(): any {
    return this.sceneContext;
  }
}
