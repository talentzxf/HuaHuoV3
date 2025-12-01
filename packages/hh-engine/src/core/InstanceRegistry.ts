/**
 * Generic Instance Registry
 * Maps Redux store IDs to runtime instances for bidirectional lookup
 * 
 * This solves the problem of mapping between:
 * - Redux Store: uses string IDs (componentId, gameObjectId, layerId, sceneId)
 * - Runtime: uses class instances (Component, GameObject, Layer, Scene)
 */
export class InstanceRegistry<T = any> {
  private registry = new Map<string, T>();
  /**
   * Register an instance with its ID
   * @param id The ID from Redux store
   * @param instance The runtime instance
   */
  register(id: string, instance: T): void {
    if (this.registry.has(id)) {
      console.warn(`[InstanceRegistry] Instance with id "${id}" is already registered. Overwriting...`);
    }
    this.registry.set(id, instance);
  }
  /**
   * Unregister an instance by ID
   * @param id The ID from Redux store
   * @returns true if the instance was found and removed, false otherwise
   */
  unregister(id: string): boolean {
    if (!this.registry.has(id)) {
      console.warn(`[InstanceRegistry] Attempted to unregister non-existent instance with id "${id}"`);
      return false;
    }
    return this.registry.delete(id);
  }
  /**
   * Get an instance by ID with type casting support
   * @param id The ID from Redux store
   * @returns The runtime instance or undefined
   */
  get<R = T>(id: string): R | undefined {
    return this.registry.get(id) as R | undefined;
  }
  /**
   * Check if an instance is registered
   * @param id The ID from Redux store
   */
  has(id: string): boolean {
    return this.registry.has(id);
  }
  /**
   * Get all registered IDs
   */
  getAllIds(): string[] {
    return Array.from(this.registry.keys());
  }
  /**
   * Get all registered instances
   */
  getAllInstances(): T[] {
    return Array.from(this.registry.values());
  }
  /**
   * Clear all registrations
   */
  clear(): void {
    this.registry.clear();
  }
  /**
   * Get the number of registered instances
   */
  get size(): number {
    return this.registry.size;
  }
}
/**
 * Global unified instance registry
 * All registrable entities (Component, GameObject, Layer, Scene) are stored here
 *
 * Usage:
 * ```typescript
 * // Type-safe access with generics
 * const gameObject = instanceRegistry.get<GameObject>(id);
 * const component = instanceRegistry.get<CircleRenderer>(id);
 * ```
 */
export const instanceRegistry = new InstanceRegistry<any>();

