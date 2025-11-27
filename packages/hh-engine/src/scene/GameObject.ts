import paper from 'paper';
import { IGameObject } from '../core/IGameObject';
import { IComponent, ITransform } from '../core/IComponent';
import { Transform } from '../components/Transform';
import { Component } from '../components/Component';

export class GameObject implements IGameObject {
  public name: string;
  public active: boolean = true;
  public transform: ITransform;

  public components: Component[] = [];

  private scope: paper.PaperScope;
  private layer: paper.Layer;
  private componentRegistry: Map<string, any>;

  constructor(
    name: string,
    scope: paper.PaperScope,
    layer: paper.Layer,
    componentRegistry: Map<string, any>
  ) {
    this.name = name;
    this.scope = scope;
    this.layer = layer;
    this.componentRegistry = componentRegistry;

    // Every GameObject has a Transform component
    this.transform = new Transform(this);
    this.components.push(this.transform as any);
  }

  addComponent<T extends IComponent>(componentType: string, config?: any): T {
    const factory = this.componentRegistry.get(componentType);
    if (!factory) {
      throw new Error(`Component type "${componentType}" not registered`);
    }

    const component = factory(this, this.scope, this.layer, config);
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
  }

  toJSON(): any {
    return {
      name: this.name,
      active: this.active,
      components: this.components.map(c => c.toJSON()),
    };
  }
}

