import paper from 'paper';
import { IScene } from '../core/IScene';
import { ILayer } from '../core/ILayer';
import { Layer } from './Layer';

export class Scene implements IScene {
  public name: string;
  public layers: Layer[] = [];

  private scope: paper.PaperScope;
  private componentRegistry: Map<string, any>;

  constructor(name: string, scope: paper.PaperScope, componentRegistry: Map<string, any>) {
    this.name = name;
    this.scope = scope;
    this.componentRegistry = componentRegistry;
  }

  addLayer(name: string, paperLayer?: paper.Layer): ILayer {
    const layer = new Layer(name, this.scope, this.componentRegistry, paperLayer);
    this.layers.push(layer);
    return layer;
  }

  removeLayer(layer: ILayer): void {
    const index = this.layers.indexOf(layer as Layer);
    if (index !== -1) {
      layer.destroy();
      this.layers.splice(index, 1);
    }
  }

  getLayer(name: string): ILayer | undefined {
    return this.layers.find(l => l.name === name);
  }

  update(deltaTime: number): void {
    this.layers.forEach(layer => layer.update(deltaTime));
  }

  destroy(): void {
    this.layers.forEach(layer => layer.destroy());
    this.layers = [];
  }

  toJSON(): any {
    return {
      name: this.name,
      layers: this.layers.map(layer => layer.toJSON()),
    };
  }

  static fromJSON(data: any, scope: paper.PaperScope, componentRegistry: Map<string, any>): Scene {
    const scene = new Scene(data.name, scope, componentRegistry);
    // TODO: Implement layer restoration from JSON
    return scene;
  }
}

