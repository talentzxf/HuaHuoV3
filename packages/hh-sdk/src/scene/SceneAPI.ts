import { Engine } from '@huahuo/engine';
import { IScene } from '@huahuo/engine';
import { IGameObject } from '@huahuo/engine';
import paper from 'paper';

export class SceneAPI {
  private engine: Engine;

  constructor(engine: Engine) {
    this.engine = engine;
  }

  /**
   * Create a new scene
   */
  createScene(name: string): IScene {
    return this.engine.createScene(name);
  }

  /**
   * Get the current active scene
   */
  getCurrentScene(): IScene | null {
    return this.engine.getCurrentScene();
  }

  /**
   * Load a scene from JSON data
   */
  loadScene(sceneData: any): IScene {
    return this.engine.loadScene(sceneData);
  }

  /**
   * Save the current scene to JSON
   */
  saveScene(): any {
    return this.engine.saveScene();
  }

  /**
   * Create a GameObject from a Paper.js item
   */
  createGameObjectFromPaperItem(item: paper.Item, layerName?: string): IGameObject | null {
    return this.engine.createGameObjectFromPaperItem(item, layerName);
  }

  /**
   * Register a custom component type
   */
  registerComponent(componentType: string, factory: any): void {
    this.engine.registerComponent(componentType, factory);
  }

  /**
   * Update the scene (call in game loop)
   */
  update(deltaTime: number): void {
    this.engine.update(deltaTime);
  }
}

