import { IScene } from './core/IScene';
import { IGameObject } from './core/IGameObject';
import { Scene } from './scene/Scene';
import { IRenderer, PaperRenderer, ReduxAdapter } from './renderer';
import { ComponentRegistry } from './core/ComponentRegistry';
import { registerBuiltInComponents } from './components/registerComponents';
import type { Store } from '@reduxjs/toolkit';
import type { EngineState } from './store/store';
import { initEngineStore } from './core/EngineGlobals';

export class Engine {
  private currentScene: Scene | null = null;
  private renderer: IRenderer;
  private reduxAdapter: ReduxAdapter;
  private sceneContext: any;
  private selectedGameObjectId: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    store: Store,
    selectEngineState: (state: any) => EngineState,
    renderer?: IRenderer
  ) {
    // Initialize global store reference
    initEngineStore(store, selectEngineState);

    this.renderer = renderer || new PaperRenderer();
    this.renderer.initialize(canvas);
    this.sceneContext = this.renderer.createSceneContext();

    // Setup Redux to Renderer adapter
    this.reduxAdapter = new ReduxAdapter(this.renderer, store);
    this.reduxAdapter.startListening();

    // Register built-in components
    registerBuiltInComponents();
  }

  /**
   * Select a GameObject (updates Paper.js render item selection state)
   * This should be called by IDE when selection changes
   */
  selectGameObject(gameObjectId: string | null): void {
    // Deselect previous
    if (this.selectedGameObjectId) {
      const prevRenderItem = (this.renderer as any).getRenderItem?.(this.selectedGameObjectId);
      if (prevRenderItem) {
        prevRenderItem.selected = false;
      }
    }

    // Select new
    this.selectedGameObjectId = gameObjectId;
    if (gameObjectId) {
      const currRenderItem = (this.renderer as any).getRenderItem?.(gameObjectId);
      if (currRenderItem) {
        currRenderItem.selected = true;
      }
    }

    // Trigger render
    this.renderer.render();
  }

  /**
   * Get currently selected GameObject ID
   */
  getSelectedGameObjectId(): string | null {
    return this.selectedGameObjectId;
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

    // Store GameObject ID in Paper.js item data for quick reverse lookup
    item.data = item.data || {};
    item.data.gameObjectId = gameObject.id;

    // Set Transform from Paper.js item
    gameObject.transform.position = { x: item.position.x, y: item.position.y };
    gameObject.transform.rotation = item.rotation || 0;
    gameObject.transform.scale = {
      x: item.scaling?.x || 1,
      y: item.scaling?.y || 1
    };


    // Extract visual properties and add Visual component
    // The item itself (circle, rectangle, or any shape) is the renderItem
    // Shape can be changed later through vertex editing tools
    gameObject.addComponent('Visual', {
      fillColor: item.fillColor ? this.colorToCSS(item.fillColor) : undefined,
      strokeColor: item.strokeColor ? this.colorToCSS(item.strokeColor) : undefined,
      strokeWidth: item.strokeWidth || 2,
      opacity: item.opacity !== undefined ? item.opacity : 1,
    });

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
    this.reduxAdapter.stopListening();
    this.renderer.dispose();
  }

  getRenderer(): IRenderer {
    return this.renderer;
  }

  getSceneContext(): any {
    return this.sceneContext;
  }

  /**
   * Handle canvas resize - updates view transformation to scale and center content
   * Uses Paper.js view.scaling and view.center instead of transforming individual layers
   * @param containerWidth - Container width in pixels
   * @param containerHeight - Container height in pixels
   * @param baseWidth - Base canvas width for scaling reference (default: 800)
   * @param baseHeight - Base canvas height for scaling reference (default: 600)
   */
  handleCanvasResize(
    containerWidth: number,
    containerHeight: number,
    baseWidth: number = 800,
    baseHeight: number = 600
  ): void {
    if (!this.sceneContext || !this.currentScene) {
      console.warn('[Engine.handleCanvasResize] No sceneContext or currentScene');
      return;
    }

    const scope = this.sceneContext;
    const view = scope.view;

    // Skip resize if container is hidden (width/height = 0)
    if (containerWidth === 0 || containerHeight === 0) {
      console.log('[Engine.handleCanvasResize] Container hidden, skipping resize');
      return;
    }

    console.log('[Engine.handleCanvasResize] ===== RESIZE START =====');
    console.log('[Engine.handleCanvasResize] Container:', containerWidth, 'x', containerHeight);
    console.log('[Engine.handleCanvasResize] Base:', baseWidth, 'x', baseHeight);

    // Calculate scale ratio
    const scaleX = containerWidth / baseWidth;
    const scaleY = containerHeight / baseHeight;
    const ratio = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding

    // Calculate content dimensions and padding
    const scaledWidth = baseWidth * ratio;
    const scaledHeight = baseHeight * ratio;
    const paddingX = (containerWidth - scaledWidth) / 2;
    const paddingY = (containerHeight - scaledHeight) / 2;

    console.log('[Engine.handleCanvasResize] Ratio:', ratio, 'Padding:', paddingX, ',', paddingY);

    // Set view size first
    view.viewSize = new scope.Size(containerWidth, containerHeight);

    // Apply view zoom (scaling)
    view.zoom = ratio;

    // Center the view on the middle of the canvas
    // The canvas is at (0, 0) to (baseWidth, baseHeight)
    // We want to center it in the view
    const centerX = baseWidth / 2;
    const centerY = baseHeight / 2;
    view.center = new scope.Point(centerX, centerY);

    console.log('[Engine.handleCanvasResize] View zoom:', view.zoom);
    console.log('[Engine.handleCanvasResize] View center:', view.center.toString());
    console.log('[Engine.handleCanvasResize] ===== RESIZE END =====');

    // Trigger render
    this.renderer.render();
  }
}
