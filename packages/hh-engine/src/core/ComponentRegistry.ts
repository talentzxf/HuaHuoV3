/**
 * Global component registry
 * Stores factory functions and metadata for creating component instances
 */

import { getPropertyConfigFromClass } from './PropertyConfig';

export class ComponentRegistry {
  private static instance: ComponentRegistry | null = null;
  private factories = new Map<string, any>();
  private componentClasses = new Map<string, any>();

  private constructor() {}

  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  /**
   * Register a component with its class
   * Factory will be automatically generated from the class constructor
   * @param componentType - The name/type of the component (e.g., 'Transform')
   * @param componentClass - The component class
   */
  register(componentType: string, componentClass: any): void {
    // Auto-generate factory from class constructor
    const factory = (gameObject: any, _layerContext: any, config: any) => {
      return new componentClass(gameObject, config);
    };

    this.factories.set(componentType, factory);
    this.componentClasses.set(componentType, componentClass);
  }

  /**
   * Get a component factory by type
   * @param componentType - The name/type of the component
   * @returns The factory function, or undefined if not found
   */
  getFactory(componentType: string): any {
    return this.factories.get(componentType);
  }

  /**
   * Get component class by type
   * @param componentType - The name/type of the component
   */
  getComponentClass(componentType: string): any {
    return this.componentClasses.get(componentType);
  }

  /**
   * Get property metadata for a component property
   * Reads from reflect-metadata stored by @PropertyConfig decorators
   * @param componentType - The component type name
   * @param propertyName - The property name
   */
  getPropertyMetadata(componentType: string, propertyName: string): any {
    const componentClass = this.componentClasses.get(componentType);
    if (!componentClass) return undefined;

    // Read from reflect-metadata
    return getPropertyConfigFromClass(componentClass, propertyName);
  }

  /**
   * Get all property metadata for a component
   * @param componentType - The component type name
   */
  getAllPropertyMetadata(componentType: string): Record<string, any> {
    const componentClass = this.componentClasses.get(componentType);
    if (!componentClass) return {};

    // This would require iterating all properties - not implemented for now
    return {};
  }

  /**
   * Check if a component type is registered
   * @param componentType - The name/type of the component
   */
  hasFactory(componentType: string): boolean {
    return this.factories.has(componentType);
  }

  /**
   * Reset the registry (for testing)
   */
  static reset(): void {
    ComponentRegistry.instance = null;
  }
}

