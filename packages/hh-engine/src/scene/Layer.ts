import paper from 'paper';
import { ILayer } from '../core/ILayer';
import { IGameObject } from '../core/IGameObject';
import { GameObject } from './GameObject';

export class Layer implements ILayer {
  public name: string;
  public gameObjects: GameObject[] = [];
  public visible: boolean = true;
  public locked: boolean = false;

  private paperLayer: paper.Layer;
  private scope: paper.PaperScope;
  private componentRegistry: Map<string, any>;

  constructor(name: string, scope: paper.PaperScope, componentRegistry: Map<string, any>, paperLayer?: paper.Layer) {
    this.name = name;
    this.scope = scope;
    this.componentRegistry = componentRegistry;

    // Use provided paper layer or create a new one
    if (paperLayer) {
      this.paperLayer = paperLayer;
      this.paperLayer.name = name;
    } else {
      this.paperLayer = new scope.Layer();
      this.paperLayer.name = name;
    }
  }

  addGameObject(name: string): IGameObject {
    const gameObject = new GameObject(name, this.scope, this.paperLayer, this.componentRegistry);
    this.gameObjects.push(gameObject);
    return gameObject;
  }

  removeGameObject(gameObject: IGameObject): void {
    const index = this.gameObjects.indexOf(gameObject as GameObject);
    if (index !== -1) {
      gameObject.destroy();
      this.gameObjects.splice(index, 1);
    }
  }

  findGameObject(name: string): IGameObject | undefined {
    return this.gameObjects.find(obj => obj.name === name);
  }

  update(deltaTime: number): void {
    if (!this.visible) return;
    this.gameObjects.forEach(obj => obj.update(deltaTime));
  }

  destroy(): void {
    this.gameObjects.forEach(obj => obj.destroy());
    this.gameObjects = [];
    this.paperLayer.remove();
  }

  getPaperLayer(): paper.Layer {
    return this.paperLayer;
  }

  toJSON(): any {
    return {
      name: this.name,
      visible: this.visible,
      locked: this.locked,
      gameObjects: this.gameObjects.map(obj => obj.toJSON()),
    };
  }
}

