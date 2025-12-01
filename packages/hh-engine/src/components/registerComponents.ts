/**
 * Component registration module
 * Each component registers itself using the ComponentRegistry
 */
import { ComponentRegistry } from '../core/ComponentRegistry';
import { Visual } from './Visual';

/**
 * Register all built-in components
 * This function should be called once during engine initialization
 */
export function registerBuiltInComponents(): void {
  const registry = ComponentRegistry.getInstance();

  // Register Visual component (data component for visual properties)
  registry.register('Visual', (gameObject: any, _layerContext: any, config: any) => {
    return new Visual(gameObject, config);
  });

  // Future components can be added here:
  // registry.register('Physics', ...);
  // registry.register('Collider', ...);
  // registry.register('Script', ...);
}

