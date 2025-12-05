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
   * Handle canvas resize - updates view size and scales all layers appropriately
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

    // Skip resize if container is hidden (width/height = 0)
    if (containerWidth === 0 || containerHeight === 0) {
      console.log('[Engine.handleCanvasResize] Container hidden, skipping resize');
      return;
    }

    console.log('[Engine.handleCanvasResize] ===== RESIZE START =====');
    console.log('[Engine.handleCanvasResize] Container size:', containerWidth, 'x', containerHeight);
    console.log('[Engine.handleCanvasResize] Base size:', baseWidth, 'x', baseHeight);

    // Update Paper.js view size
    scope.view.viewSize = new scope.Size(containerWidth, containerHeight);

    // Calculate scale to fit canvas in container
    const scaleX = containerWidth / baseWidth;
    const scaleY = containerHeight / baseHeight;
    const scale = Math.min(scaleX, scaleY) * 0.9; // 0.9 for padding

    console.log('[Engine.handleCanvasResize] Scale calculations - scaleX:', scaleX, 'scaleY:', scaleY, 'final scale:', scale);

    // Calculate position to center the canvas
    const scaledWidth = baseWidth * scale;
    const scaledHeight = baseHeight * scale;
    const offsetX = (containerWidth - scaledWidth) / 2;
    const offsetY = (containerHeight - scaledHeight) / 2;

    console.log('[Engine.handleCanvasResize] Scaled size:', scaledWidth, 'x', scaledHeight);
    console.log('[Engine.handleCanvasResize] Offset (center position):', offsetX, ',', offsetY);

    // Apply transformation ONLY to background layer
    // All other layers (drawing layers) should maintain identity transform
    // so that user drawing coordinates work correctly
    this.currentScene.layers.forEach((layer, index) => {
      const layerContext = layer.getLayerContext();

      console.log(`[Engine.handleCanvasResize] Layer ${index} (${layer.name})`);
      console.log(`  - applyMatrix:`, layerContext.applyMatrix);
      console.log(`  - matrix before:`, layerContext.matrix.toString());
      console.log(`  - children count:`, layerContext.children.length);

      // Only transform the background layer
      // All drawing layers should keep identity transform
      if (layer.name === 'background') {
        // First, remove previous resize transformation if exists
        if (layerContext._resizeTransform) {
          layerContext.transform(layerContext._resizeTransform.inverted());
        }

        // Create and apply new transformation matrix
        const newTransform = new scope.Matrix(scale, 0, 0, scale, offsetX, offsetY);
        layerContext.transform(newTransform);

        // Store it for next resize (so we can invert it)
        layerContext._resizeTransform = newTransform;

        console.log(`  - matrix after:`, layerContext.matrix.toString());
      } else {
        console.log(`  - Skipping transformation for non-background layer`);
      }
    });

    console.log('[Engine.handleCanvasResize] ===== RESIZE END =====');

    // Trigger render
    this.renderer.render();
  }
}
