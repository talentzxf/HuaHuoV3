import { IGameObject } from '../core/IGameObject';
import { IComponent, ITransform } from '../core/IComponent';
import { ComponentBase } from '../components/ComponentBase';
import { IRenderer } from '../renderer';
import { getKernel } from '../core/KernelBridge';
import { ComponentRegistry } from '../core/ComponentRegistry';
import { RegistrableEntity } from '../core/RegistrableEntity';

export class GameObject extends RegistrableEntity implements IGameObject {
  public transform: ITransform;
  public components: ComponentBase[] = [];

  private renderer: IRenderer;
  private layerContext: any;
  private renderItem: any;

  constructor(
    gameObjectId: string,
    renderer: IRenderer,
    layerContext: any,
    renderItem?: any
  ) {
    super(gameObjectId);

    this.renderer = renderer;
    this.layerContext = layerContext;
    this.renderItem = renderItem;

    if (renderItem && (renderer as any).registerRenderItem) {
      (renderer as any).registerRenderItem(gameObjectId, renderItem);
    }

    const initialTransform = renderItem ? {
      position: { x: renderItem.position?.x || 0, y: renderItem.position?.y || 0 },
      rotation: renderItem.rotation || 0,
      scale: { x: renderItem.scaling?.x || 1, y: renderItem.scaling?.y || 1 }
    } : { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } };

    this.transform = this.addComponent<ITransform>('Transform', initialTransform);
    this.addComponent('Timeline', {});
  }

  get name(): string {
    const kernel = getKernel();
    if (!kernel.ready) return 'Unknown';
    return kernel.getGameObject(this.id)?.name ?? 'Unknown';
  }

  set name(_value: string) {
    // TODO: kernel rename command
  }

  get active(): boolean {
    const kernel = getKernel();
    if (!kernel.ready) return true;
    return kernel.getGameObject(this.id)?.active ?? true;
  }

  set active(value: boolean) {
    const kernel = getKernel();
    if (kernel.ready) kernel.setGameObjectActive(this.id, value);
  }

  addComponent<T extends IComponent>(componentType: string, config?: any): T;
  addComponent<T extends IComponent>(ComponentClass: new (gameObject: IGameObject, config?: any) => T, config?: any): T;
  addComponent<T extends IComponent>(
    componentTypeOrClass: string | (new (gameObject: IGameObject, config?: any) => T),
    config?: any
  ): T {
    let component: T;

    if (typeof componentTypeOrClass === 'string') {
      const componentType = componentTypeOrClass;
      const registry = ComponentRegistry.getInstance();
      const factory = registry.getFactory(componentType);
      if (!factory) throw new Error(`Component type "${componentType}" not registered`);

      // Register initial keyframes in the kernel for each config property
      const kernel = getKernel();
      const frame = kernel.ready ? (kernel.getPlaybackState()?.current_frame ?? 0) : 0;
      if (kernel.ready && config) {
        for (const [propName, value] of Object.entries(config)) {
          kernel.setKeyframe(this.id, componentType, propName, frame, value);
        }
      }

      component = factory(this, this.layerContext, config);
    } else {
      const ComponentClass = componentTypeOrClass;
      const tempInstance = new ComponentClass(this, config);
      const componentType = tempInstance.type;

      const kernel = getKernel();
      const frame = kernel.ready ? (kernel.getPlaybackState()?.current_frame ?? 0) : 0;
      if (kernel.ready && config) {
        for (const [propName, value] of Object.entries(config)) {
          kernel.setKeyframe(this.id, componentType, propName, frame, value);
        }
      }

      component = tempInstance;
    }

    this.components.push(component as any);
    (component as any).onAdd();
    return component;
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
    this.components.forEach(c => { if (c.enabled) c.update(deltaTime); });
  }

  destroy(): void {
    this.components.forEach(c => c.onRemove());
    this.components = [];
    this.unregister();
    if ((this.renderer as any).unregisterRenderItem) {
      (this.renderer as any).unregisterRenderItem(this.id);
    }
    if (this.renderItem) {
      this.renderer.removeRenderItem(this.renderItem);
      this.renderItem = null;
    }
  }
}
