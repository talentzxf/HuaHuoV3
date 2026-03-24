import { IScene } from './core/IScene';
import { IGameObject } from './core/IGameObject';
import { Scene } from './scene/Scene';
import { IRenderer, PaperRenderer } from './renderer';
import { KernelAdapter } from './renderer/KernelAdapter';
import { ComponentRegistry } from './core/ComponentRegistry';
import { registerBuiltInComponents } from './components/registerComponents';
import { KernelBridge, getKernel } from './core/KernelBridge';

export class Engine {
  private currentScene: Scene | null = null;
  private renderer: IRenderer;
  private kernelAdapter: KernelAdapter;
  private sceneContext: any;
  private selectedGameObjectId: string | null = null;
  private kernel: KernelBridge;

  constructor(
    canvas: HTMLCanvasElement,
    renderer?: IRenderer
  ) {
    this.kernel = getKernel();

    this.renderer = renderer || new PaperRenderer();
    this.renderer.initialize(canvas);
    this.sceneContext = this.renderer.createSceneContext();

    // KernelAdapter subscribes to WASM events → updates Paper.js
    this.kernelAdapter = new KernelAdapter(
      this.renderer,
      this.kernel,
      () => this.selectedGameObjectId,
    );
    this.kernelAdapter.startListening();

    // Register built-in components
    registerBuiltInComponents();
  }

  /**
   * Select a GameObject (updates Paper.js render item selection state).
   */
  selectGameObject(gameObjectId: string | null): void {
    if (this.selectedGameObjectId) {
      const prev = (this.renderer as any).getRenderItem?.(this.selectedGameObjectId);
      if (prev) prev.selected = false;
    }
    this.selectedGameObjectId = gameObjectId;
    if (gameObjectId) {
      const curr = (this.renderer as any).getRenderItem?.(gameObjectId);
      if (curr) curr.selected = true;
    }
    this.renderer.render();
  }

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

  loadScene(_sceneData: any): IScene {
    throw new Error('loadScene not implemented yet');
  }

  saveScene(): any { return null; }

  createGameObjectFromPaperItem(item: any, layerName?: string): IGameObject | null {
    if (!this.currentScene) {
      console.warn('No active scene');
      return null;
    }

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

    const gameObject = layer.addGameObject(item.name || 'GameObject', item);
    item.data = item.data || {};
    item.data.gameObjectId = gameObject.id;

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
    if (typeof color.toCSS === 'function') return color.toCSS(true);
    if (color.red !== undefined) {
      const r = Math.round(color.red * 255);
      const g = Math.round(color.green * 255);
      const b = Math.round(color.blue * 255);
      const a = color.alpha !== undefined ? color.alpha : 1;
      if (a < 1) return `rgba(${r}, ${g}, ${b}, ${a})`;
      return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`;
    }
    return '#000000';
  }

  update(deltaTime: number): void {
    this.currentScene?.update(deltaTime);
  }

  dispose(): void {
    this.kernelAdapter.stopListening();
    this.renderer.dispose();
  }

  getRenderer(): IRenderer { return this.renderer; }
  getSceneContext(): any { return this.sceneContext; }
  getKernel(): KernelBridge { return this.kernel; }

  /**
   * Handle canvas resize — updates Paper.js view transform.
   */
  handleCanvasResize(
    containerWidth: number,
    containerHeight: number,
    baseWidth: number = 800,
    baseHeight: number = 600
  ): void {
    if (!this.sceneContext || !this.currentScene) return;
    if (containerWidth === 0 || containerHeight === 0) return;

    const scope = this.sceneContext;
    const view = scope.view;

    const scaleX = containerWidth / baseWidth;
    const scaleY = containerHeight / baseHeight;
    const ratio = Math.min(scaleX, scaleY) * 0.9;

    view.viewSize = new scope.Size(containerWidth, containerHeight);
    view.zoom = ratio;
    view.center = new scope.Point(baseWidth / 2, baseHeight / 2);

    this.renderer.render();
  }
}
