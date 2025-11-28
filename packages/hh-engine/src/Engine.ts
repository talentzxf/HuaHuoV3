import paper from 'paper';
import { IScene } from './core/IScene';
import { IGameObject } from './core/IGameObject';
import { Scene } from './scene/Scene';
import { CircleRenderer } from './components/CircleRenderer';
import { RectangleRenderer } from './components/RectangleRenderer';

export class Engine {
  private currentScene: Scene | null = null;
  private scope: paper.PaperScope;
  private componentRegistry = new Map<string, any>();

  constructor(scope: paper.PaperScope) {
    this.scope = scope;
    this.registerDefaultComponents();
  }

  private registerDefaultComponents(): void {
    // Register built-in components
    this.registerComponent('CircleRenderer', (gameObject: any, scope: any, layer: any, config: any) => {
      return new CircleRenderer(gameObject, scope, layer, config);
    });

    this.registerComponent('RectangleRenderer', (gameObject: any, scope: any, layer: any, config: any) => {
      return new RectangleRenderer(gameObject, scope, layer, config);
    });
  }

  registerComponent(componentType: string, factory: any): void {
    this.componentRegistry.set(componentType, factory);
  }

  createScene(name: string): IScene {
    this.currentScene = new Scene(name, this.scope, this.componentRegistry);
    return this.currentScene;
  }

  getCurrentScene(): IScene | null {
    return this.currentScene;
  }

  loadScene(sceneData: any): IScene {
    this.currentScene = Scene.fromJSON(sceneData, this.scope, this.componentRegistry);
    return this.currentScene;
  }

  saveScene(): any {
    return this.currentScene?.toJSON();
  }

  createGameObjectFromPaperItem(item: paper.Item, layerName?: string): IGameObject | null {
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

    // Create GameObject
    const gameObject = layer.addGameObject(item.name || 'GameObject');

    // Set Transform
    gameObject.transform.position = { x: item.position.x, y: item.position.y };
    gameObject.transform.rotation = item.rotation;

    // Add appropriate renderer based on Paper.js item type
    if (item instanceof this.scope.Path.Circle) {
      const circle = item as paper.Path.Circle;
        gameObject.addComponent('CircleRenderer', {
        radius: circle.bounds.width / 2,
        fillColor: circle.fillColor?.toCSS(true),
        strokeColor: circle.strokeColor?.toCSS(true),
        strokeWidth: circle.strokeWidth,
      });
    } else if (item instanceof this.scope.Path.Rectangle) {
      const rect = item as paper.Path.Rectangle;
      gameObject.addComponent('RectangleRenderer', {
        width: rect.bounds.width,
        height: rect.bounds.height,
        fillColor: rect.fillColor?.toCSS(true),
        strokeColor: rect.strokeColor?.toCSS(true),
        strokeWidth: rect.strokeWidth,
      });
    }

    return gameObject;
  }

  update(deltaTime: number): void {
    this.currentScene?.update(deltaTime);
  }
}

