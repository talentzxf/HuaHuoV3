import { IGameObject } from '../core/IGameObject';
import { IComponent, ITransform } from '../core/IComponent';
import { Transform } from '../components/Transform';
import { Component } from '../components/Component';
import { IRenderer } from '../renderer';
import { getEngineState, getEngineStore } from '../core/EngineGlobals';
import { ComponentRegistry } from '../core/ComponentRegistry';
import { createComponent } from '../store/ComponentSlice';
import { RegistrableEntity } from '../core/RegistrableEntity';

export class GameObject extends RegistrableEntity implements IGameObject {
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
    // Call RegistrableEntity constructor - auto-registers
    super(gameObjectId);

    this.renderer = renderer;
    this.layerContext = layerContext;
    this.renderItem = renderItem;

    // Register render item in renderer's registry
    if (renderItem && (renderer as any).registerRenderItem) {
      (renderer as any).registerRenderItem(gameObjectId, renderItem);
    }

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

    // Create component data in Redux Store first
    getEngineStore().dispatch(createComponent(componentType, this.id, config || {}));

    // Then create the behavior wrapper
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

    // Unregister from registry (base class handles this)
    this.unregister();

    // Unregister render item from renderer's registry
    if ((this.renderer as any).unregisterRenderItem) {
      (this.renderer as any).unregisterRenderItem(this.id);
    }

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
