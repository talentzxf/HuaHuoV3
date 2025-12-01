import { IGameObject } from '../core/IGameObject';
import { IComponent, ITransform } from '../core/IComponent';
import { Transform } from '../components/Transform';
import { Component } from '../components/Component';
import { IRenderer } from '../renderer';
import { getEngineState } from '../Engine';
import { ComponentRegistry } from '../core/ComponentRegistry';

export class GameObject implements IGameObject {
  public readonly id: string;
  public transform: ITransform;

  public components: Component[] = [];

  private renderer: IRenderer;
  private layerContext: any;
  private renderItem: any;

  constructor(
    gameObjectId: string,
    renderer: IRenderer,
    layerContext: any,
    renderItem?: any
  ) {
    this.id = gameObjectId;
    this.renderer = renderer;
    this.layerContext = layerContext;
    this.renderItem = renderItem;

    // Every GameObject has a Transform component
    this.transform = new Transform(this);
    this.components.push(this.transform as any);
  }

  get name(): string {
    const engineState = getEngineState();
    return engineState.gameObjects.byId[this.id]?.name || 'Unknown';
  }

  set name(value: string) {
    // TODO: dispatch action to update name in redux
  }

  get active(): boolean {
    const engineState = getEngineState();
    return engineState.gameObjects.byId[this.id]?.active ?? true;
  }

  set active(value: boolean) {
    // TODO: dispatch action to update active in redux
  }

  addComponent<T extends IComponent>(componentType: string, config?: any): T {
    const registry = ComponentRegistry.getInstance();
    const factory = registry.getFactory(componentType);
    if (!factory) {
      throw new Error(`Component type "${componentType}" not registered`);
    }

    const component = factory(this, this.layerContext, config);
    this.components.push(component);
    component.onAdd();
    return component as T;
  }

  getComponent<T extends IComponent>(componentType: string): T | undefined {
    return this.components.find(c => c.type === componentType) as T | undefined;
  }

  getComponents<T extends IComponent>(componentType: string): T[] {
    return this.components.filter(c => c.type === componentType) as unknown as T[];
  }

  removeComponent(component: IComponent): void {
    const index = this.components.indexOf(component as any);
    if (index !== -1) {
      (component as any).onRemove();
      this.components.splice(index, 1);
    }
  }

  update(deltaTime: number): void {
    if (!this.active) return;
    this.components.forEach(component => {
      if (component.enabled) {
        component.update(deltaTime);
      }
    });
  }

  destroy(): void {
    this.components.forEach(component => component.onRemove());
    this.components = [];

    if (this.renderItem) {
      this.renderer.removeRenderItem(this.renderItem);
      this.renderItem = null;
    }
  }


  getRenderItem(): any {
    return this.renderItem;
  }

  setRenderItem(item: any): void {
    this.renderItem = item;
  }
}
