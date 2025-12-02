import { IComponent } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { getEngineStore, getEngineState } from '../core/EngineGlobals';
import { updateComponentProps } from '../store/ComponentSlice';
import { instanceRegistry } from '../core/InstanceRegistry';
import { createComponentProxy } from '../core/ComponentProxy';

export abstract class ComponentBase implements IComponent {
  public enabled: boolean = true;
  public abstract readonly type: string;

  protected gameObject: IGameObject;
  protected componentId: string | null = null;

  constructor(gameObject: IGameObject, config?: Record<string, any>) {
    this.gameObject = gameObject;

    // Automatically wrap this component with a Proxy for auto-syncing properties
    return createComponentProxy(this, config);
  }

  // Lifecycle methods
  onAdd(): void {
    // Find this component's ID in the store
    const state = getEngineState();
    const component = Object.values(state.components.byId).find(
      (c: any) => c.parentId === this.gameObject.id && c.type === this.type
    );
    if (component) {
      this.componentId = (component as any).id;
      // Register this component instance for ReduxAdapter to call applyToRenderer
      if (this.componentId) {
        instanceRegistry.register(this.componentId, this);
      }
    }
  }

  onRemove(): void {
    // Unregister from instance registry
    if (this.componentId) {
      instanceRegistry.unregister(this.componentId);
    }
  }
  update(deltaTime: number): void {}

  /**
   * Apply this component's data to the renderer
   * Override in subclasses to implement specific rendering logic
   * @param renderer The renderer to apply changes to
   * @param renderItem The render item to update
   */
  applyToRenderer(renderer: any, renderItem: any): void {
    // Default: do nothing
    // Subclasses override this to implement their specific rendering logic
  }

  /**
   * Get component props from Redux Store
   */
  protected getProps(): Record<string, any> {
    if (!this.componentId) return {};
    const state = getEngineState();
    return state.components.byId[this.componentId]?.props || {};
  }

  /**
   * Update a single prop in Redux Store
   */
  protected updateProp(key: string, value: any): void {
    if (!this.componentId) return;
    getEngineStore().dispatch(updateComponentProps({
      id: this.componentId,
      patch: { [key]: value }
    }));
  }

  /**
   * Update multiple props in Redux Store
   */
  protected updateProps(patch: Record<string, any>): void {
    if (!this.componentId) return;
    getEngineStore().dispatch(updateComponentProps({
      id: this.componentId,
      patch
    }));
  }
}


