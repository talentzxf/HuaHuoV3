import { IGameObject } from '../core/IGameObject';
import { IComponent, ITransform } from '../core/IComponent';
import { Transform } from '../components/Transform';
import { ComponentBase } from '../components/ComponentBase';
import { IRenderer } from '../renderer';
import { getEngineState, getEngineStore } from '../core/EngineGlobals';
import { ComponentRegistry } from '../core/ComponentRegistry';
import { createComponent } from '../store/ComponentSlice';
import { attachComponentToGameObject } from '../store/GameObjectSlice';
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
    // Call RegistrableEntity constructor - auto-registers
    super(gameObjectId);

    this.renderer = renderer;
    this.layerContext = layerContext;
    this.renderItem = renderItem;

    // Register render item in renderer's registry
    if (renderItem && (renderer as any).registerRenderItem) {
      console.debug('[GameObject] Registering render item for GameObject:', gameObjectId);
      (renderer as any).registerRenderItem(gameObjectId, renderItem);
    } else if (!renderItem) {
      console.debug('[GameObject] No render item to register for GameObject:', gameObjectId);
    }

    // Every GameObject has a Transform component
    // Initialize with renderItem's transform if available
    const initialTransform = renderItem ? {
      position: { x: renderItem.position?.x || 0, y: renderItem.position?.y || 0 },
      rotation: renderItem.rotation || 0,
      scale: {
        x: renderItem.scaling?.x || 1,
        y: renderItem.scaling?.y || 1
      }
    } : {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 }
    };

    this.transform = this.addComponent<ITransform>('Transform', initialTransform);

    // Every GameObject also has a Timeline component for UI/editing animation
    // Timeline component doesn't store data - it just provides helper methods
    this.addComponent('Timeline', {});
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

  addComponent<T extends IComponent>(componentType: string, config?: any): T;
  addComponent<T extends IComponent>(ComponentClass: new (gameObject: IGameObject, config?: any) => T, config?: any): T;
  addComponent<T extends IComponent>(componentTypeOrClass: string | (new (gameObject: IGameObject, config?: any) => T), config?: any): T {
    let componentType: string;
    let component: T;

    if (typeof componentTypeOrClass === 'string') {
      // Legacy: string-based component type (for backward compatibility)
      componentType = componentTypeOrClass;

      const registry = ComponentRegistry.getInstance();
      const factory = registry.getFactory(componentType);
      if (!factory) {
        throw new Error(`Component type "${componentType}" not registered`);
      }

      // ✅ Get current frame for initial keyframe recording
      const currentFrame = getEngineState().playback.currentFrame;

      // Create component data in Redux Store first
      const componentAction = getEngineStore().dispatch(createComponent(componentType, this.id, config || {}, currentFrame));
      const componentId = componentAction.payload.id;

      // Attach component to this GameObject
      getEngineStore().dispatch(attachComponentToGameObject({
        objectId: this.id,
        componentId: componentId
      }));

      // Then create the behavior wrapper
      component = factory(this, this.layerContext, config);
    } else {
      // New: Class-based component (recommended)
      const ComponentClass = componentTypeOrClass;

      // Create a temporary instance to get the type
      const tempInstance = new ComponentClass(this, config);
      componentType = tempInstance.type;

      // ✅ Get current frame for initial keyframe recording
      const currentFrame = getEngineState().playback.currentFrame;

      // Create component data in Redux Store
      const componentAction = getEngineStore().dispatch(createComponent(componentType, this.id, config || {}, currentFrame));
      const componentId = componentAction.payload.id;

      // Attach component to this GameObject
      getEngineStore().dispatch(attachComponentToGameObject({
        objectId: this.id,
        componentId: componentId
      }));

      // Use the instance we created (it's wrapped by Proxy already)
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

    // Remove render item from renderer
    if (this.renderItem) {
      this.renderer.removeRenderItem(this.renderItem);
      this.renderItem = null;
    }
  }
}
