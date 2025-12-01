/**
 * Global component registry
 * Stores factory functions for creating component instances
 */
export class ComponentRegistry {
  private static instance: ComponentRegistry | null = null;
  private factories = new Map<string, any>();

  private constructor() {}

  static getInstance(): ComponentRegistry {
    if (!ComponentRegistry.instance) {
      ComponentRegistry.instance = new ComponentRegistry();
    }
    return ComponentRegistry.instance;
  }

  /**
   * Register a component factory
   * @param componentType - The name/type of the component (e.g., 'CircleRenderer')
   * @param factory - Factory function that creates component instances
   */
  register(componentType: string, factory: any): void {
    this.factories.set(componentType, factory);
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

