/**
 * Decorator for auto-registering components
 * Usage: @RegisterComponent('ComponentName')
 */
import { ComponentRegistry } from '../core/ComponentRegistry';

export interface ComponentClass {
  new (gameObject: any, renderer: any, layerContext: any, config?: any): any;
}

/**
 * Component registration decorator
 * Automatically registers the component class with the ComponentRegistry
 */
export function RegisterComponent(componentType: string) {
  return function <T extends ComponentClass>(constructor: T) {
    // Store the original constructor
    const originalConstructor = constructor;

    // Create a factory function that will be used by the registry
    const factory = (gameObject: any, renderer: any, layerContext: any, config: any) => {
      return new originalConstructor(gameObject, renderer, layerContext, config);
    };

    // Register the component
    ComponentRegistry.getInstance().register(componentType, factory);

    // Return the original constructor
    return constructor;
  };
}

