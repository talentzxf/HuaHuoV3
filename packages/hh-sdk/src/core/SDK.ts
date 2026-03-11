import { Engine, getKernel } from '@huahuo/engine';
import { Layer } from '@huahuo/engine';
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
   * Initialize the SDK.
   * The data layer is now handled by KernelBridge (Rust/WASM) — no Redux store needed.
   * @param canvas - HTML Canvas element
   */
  static initialize(canvas: HTMLCanvasElement): void {
    if (!SDK._instance) {
      // Engine no longer takes a Redux store; KernelBridge is the data layer
      const engine = new Engine(canvas);
      const editorAPI = new EditorAPI();
      SDK._instance = new SDK(engine, editorAPI);

      // Create new project in the Rust kernel
      SDK._instance.createNewProject();

      // Execute all queued callbacks
      console.log(`SDK initialized, executing ${SDK._initQueue.length} queued callbacks`);
      const queue = SDK._initQueue.slice();
      SDK._initQueue = [];
      queue.forEach(callback => {
        try { callback(); }
        catch (error) { console.error('Error executing queued callback:', error); }
      });
    }
  }

  /**
   * Create a new project in the Rust kernel with default scene and layers.
   */
  private createNewProject(): void {
    console.log('[SDK.createNewProject] ===== START =====');

    const kernel = getKernel();
    if (!kernel.ready) {
      console.error('[SDK.createNewProject] Kernel not ready — skipping project creation');
      return;
    }

    // Create project in Rust kernel (also creates a DefaultScene + background + drawing layers)
    const projectId = kernel.createProject('My Animation Project', 30, 800, 600);
    console.log('[SDK.createNewProject] Kernel project created:', projectId);

    // The kernel auto-creates DefaultScene + background/drawing layers (see lib.rs CreateProject).
    // Now sync scene/layer objects into the TS-side Scene system for Paper.js rendering.
    const scene = this.Scene.createScene('DefaultScene');
    console.log('[SDK.createNewProject] TS Scene created:', scene.id);

    // Add default layers (Paper.js side)
    const backgroundLayer = scene.addLayer('background') as Layer;
    console.log('[SDK.createNewProject] Background layer created:', backgroundLayer.id);

    const drawingLayer = scene.addLayer('drawing') as Layer;
    console.log('[SDK.createNewProject] Drawing layer created:', drawingLayer.id);

    // Lock background layer to prevent selection
    backgroundLayer.locked = true;

    // Get Paper.js layer contexts
    const backgroundLayerContext = backgroundLayer.getLayerContext();
    const drawingLayerContext = drawingLayer.getLayerContext();

    // Activate background layer before creating the white canvas
    backgroundLayerContext.activate();

    const scope = this.engine.getSceneContext();

    // Create white canvas background rectangle
    const whiteCanvas = new scope.Path.Rectangle({
      point: [0, 0],
      size: [800, 600],
      fillColor: new scope.Color('white'),
      strokeColor: new scope.Color('#cccccc'),
      strokeWidth: 2,
    });
    whiteCanvas.name = 'whiteCanvas';
    whiteCanvas.locked = true;

    // Activate drawing layer for new items
    drawingLayerContext.activate();
    console.log('[SDK.createNewProject] ===== END =====');
  }

  /**
   * Get the SDK instance
   */
  static get instance(): SDK {
    if (!SDK._instance) {
      throw new Error('SDK not initialized. Call SDK.initialize(canvas) first.');
    }
    return SDK._instance;
  }

  /**
   * Check if SDK is initialized
   */
  static isInitialized(): boolean { return SDK._instance !== null; }

  /**
   * Execute a callback after SDK is initialized
   * If already initialized, executes immediately
   * Otherwise, queues the callback until initialization completes
   * @param callback - Function to execute after initialization
   */
  static executeAfterInit(callback: () => void): void {
    if (SDK.isInitialized()) {
      try { callback(); }
      catch (error) { console.error('Error executing callback:', error); }
    } else {
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
  getPaperScope(): any { return this.engine.getSceneContext(); }

  /**
   * Get the renderer (for tools to access render items)
   * @internal
   */
  getRenderer(): any { return this.engine.getRenderer(); }

  /**
   * Reset the SDK (for testing)
   */
  static reset(): void { SDK._instance = null; }
}

