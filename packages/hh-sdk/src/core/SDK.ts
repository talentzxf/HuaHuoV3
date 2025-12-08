import { Engine } from '@huahuo/engine';
import { SceneAPI } from '../scene/SceneAPI';
import { EditorAPI } from '../editor/EditorAPI';

export class SDK {
  private static _instance: SDK | null = null;
  private static _initQueue: Array<() => void> = [];

  public readonly Scene: SceneAPI;
  public readonly Editor: EditorAPI;
  private engine: Engine;

  private constructor(engine: Engine, editorAPI: EditorAPI) {
    this.engine = engine;
    this.Scene = new SceneAPI(engine);
    this.Editor = editorAPI;
  }

  /**
   * Initialize the SDK
   * @param canvas - HTML Canvas element
   * @param store - Redux store instance
   * @param selectEngineState - Selector function to get engine state from store
   */
  static initialize(canvas: HTMLCanvasElement, store: any, selectEngineState: (state: any) => any): void {
    if (!SDK._instance) {
      const engine = new Engine(canvas, store, selectEngineState);
      const editorAPI = new EditorAPI();
      SDK._instance = new SDK(engine, editorAPI);

      // Create new project with default scene and layers
      SDK._instance.createNewProject();

      // Execute all queued callbacks
      console.log(`SDK initialized, executing ${SDK._initQueue.length} queued callbacks`);
      const queue = SDK._initQueue.slice();
      SDK._initQueue = [];
      queue.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error executing queued callback:', error);
        }
      });
    }
  }

  /**
   * Create a new project with default scene and layers
   * This is called during SDK initialization
   */
  private createNewProject(): void {
    console.log('[SDK.createNewProject] ===== START =====');

    // Create default scene
    const scene = this.Scene.createScene('DefaultScene');
    console.log('[SDK.createNewProject] Scene created:', scene);

    // Add default layers
    const backgroundLayer = scene.addLayer('background');
    console.log('[SDK.createNewProject] Background layer created:', backgroundLayer.id);

    const drawingLayer = scene.addLayer('drawing');
    console.log('[SDK.createNewProject] Drawing layer created:', drawingLayer.id);

    // Lock background layer to prevent selection
    backgroundLayer.locked = true;
    console.log('[SDK.createNewProject] Background layer locked');


    // Get Paper.js layer contexts
    const backgroundLayerContext = backgroundLayer.getLayerContext();
    const drawingLayerContext = drawingLayer.getLayerContext();

    console.log('[SDK.createNewProject] Background layer context:', {
      exists: !!backgroundLayerContext,
      applyMatrix: backgroundLayerContext?.applyMatrix,
      name: backgroundLayerContext?.name
    });

    // IMPORTANT: Activate background layer before creating the white canvas
    // This ensures the white canvas is created directly in this layer
    backgroundLayerContext.activate();

    // Get the Paper.js scope for creating items
    const scope = this.engine.getSceneContext();
    console.log('[SDK.createNewProject] Got scope:', !!scope);
    console.log('[SDK.createNewProject] Active layer before creating canvas:', scope.project.activeLayer?.name || 'null');

    // Create white canvas background rectangle (800x600, 4:3 aspect ratio)
    // It will be automatically added to the currently active layer (backgroundLayerContext)
    const whiteCanvas = new scope.Path.Rectangle({
      point: [0, 0],
      size: [800, 600],
      fillColor: new scope.Color('white'),
      strokeColor: new scope.Color('#cccccc'),
      strokeWidth: 2,
    });
    whiteCanvas.name = 'whiteCanvas';
    whiteCanvas.locked = true;

    console.log('[SDK.createNewProject] White canvas created and added:', {
      name: whiteCanvas.name,
      bounds: whiteCanvas.bounds.toString(),
      fillColor: whiteCanvas.fillColor?.toCSS(true),
      parent: whiteCanvas.parent?.name || 'null',
      parentChildrenCount: whiteCanvas.parent?.children?.length || 0
    });

    // Debug: Check Paper.js project structure
    console.log('[SDK.createNewProject] Paper.js project info:');
    console.log('  - Total layers:', scope.project.layers.length);
    scope.project.layers.forEach((layer: any, index: number) => {
      console.log(`  - Layer ${index}:`, {
        name: layer.name || 'unnamed',
        children: layer.children.length,
        applyMatrix: layer.applyMatrix,
        visible: layer.visible
      });
    });

    // Activate drawing layer for new items
    drawingLayerContext.activate();
    console.log('[SDK.createNewProject] Drawing layer activated');
    console.log('[SDK.createNewProject] Active layer:', scope.project.activeLayer?.name || 'null');

    console.log('[SDK.createNewProject] ===== END =====');
  }

  /**
   * Get the SDK instance
   */
  static get instance(): SDK {
    if (!SDK._instance) {
      throw new Error('SDK not initialized. Call SDK.initialize(scope) first.');
    }
    return SDK._instance;
  }

  /**
   * Check if SDK is initialized
   */
  static isInitialized(): boolean {
    return SDK._instance !== null;
  }

  /**
   * Execute a callback after SDK is initialized
   * If already initialized, executes immediately
   * Otherwise, queues the callback until initialization completes
   * @param callback - Function to execute after initialization
   */
  static executeAfterInit(callback: () => void): void {
    if (SDK.isInitialized()) {
      // Already initialized, execute immediately
      try {
        callback();
      } catch (error) {
        console.error('Error executing callback:', error);
      }
    } else {
      // Not initialized yet, queue it
      SDK._initQueue.push(callback);
    }
  }

  /**
   * Select a GameObject (updates render item selection state)
   * Call this from IDE when selection changes
   */
  selectGameObject(gameObjectId: string | null): void {
    this.engine.selectGameObject(gameObjectId);
  }

  /**
   * Get currently selected GameObject ID
   */
  getSelectedGameObjectId(): string | null {
    return this.engine.getSelectedGameObjectId();
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
    this.engine.handleCanvasResize(containerWidth, containerHeight, baseWidth, baseHeight);
  }

  /**
   * Get the Paper.js scope (for tools and UI to use the same context)
   */
  getPaperScope(): any {
    return this.engine.getSceneContext();
  }

  /**
   * Get the renderer (for tools to access render items)
   * @internal
   */
  getRenderer(): any {
    return this.engine.getRenderer();
  }

  /**
   * Get the engine instance (for internal SDK use only)
   */
  private getEngine(): Engine {
    return this.engine;
  }

  /**
   * Reset the SDK (for testing)
   */
  static reset(): void {
    SDK._instance = null;
  }
}

