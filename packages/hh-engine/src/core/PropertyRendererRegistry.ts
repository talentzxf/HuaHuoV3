/**
 * Property renderer function type
 * Receives component data and callbacks, returns any (typically a React element)
 * We use 'any' here to avoid React dependency in the engine layer
 */
export type PropertyRendererFunction = (props: {
  component: any;
  gameObjectId: string;
  onPropertyChange: (componentId: string, propName: string, value: any) => void;
}) => any;

/**
 * Registry for custom property renderers
 * Maps component types to their custom renderers
 */
class ComponentPropertyRendererRegistry {
  private static instance: ComponentPropertyRendererRegistry;
  private renderers: Map<string, PropertyRendererFunction>;

  private constructor() {
    this.renderers = new Map();
  }

  static getInstance(): ComponentPropertyRendererRegistry {
    if (!ComponentPropertyRendererRegistry.instance) {
      ComponentPropertyRendererRegistry.instance = new ComponentPropertyRendererRegistry();
    }
    return ComponentPropertyRendererRegistry.instance;
  }

  /**
   * Register a custom property renderer for a component type
   */
  register(componentType: string, renderer: PropertyRendererFunction): void {
    this.renderers.set(componentType, renderer);
  }

  /**
   * Get the custom renderer for a component type
   * Returns undefined if no custom renderer is registered
   */
  getRenderer(componentType: string): PropertyRendererFunction | undefined {
    return this.renderers.get(componentType);
  }

  /**
   * Check if a component type has a custom renderer
   */
  hasRenderer(componentType: string): boolean {
    return this.renderers.has(componentType);
  }
}

export default ComponentPropertyRendererRegistry;

/**
 * Decorator to register a custom property renderer for a component
 * Usage: @PropertyRenderer(TimelinePropertyRenderer)
 *
 * @param rendererComponent - The React component to use for rendering properties
 */
export function PropertyRenderer(rendererComponent: PropertyRendererFunction) {
  return function <T extends { new(...args: any[]): any }>(constructor: T) {
    // Get the component type from the prototype
    const instance = new constructor({} as any);
    const componentType = instance.type;

    if (componentType) {
      // Register the custom renderer
      const registry = ComponentPropertyRendererRegistry.getInstance();
      registry.register(componentType, rendererComponent);
    }

    return constructor;
  };
}

