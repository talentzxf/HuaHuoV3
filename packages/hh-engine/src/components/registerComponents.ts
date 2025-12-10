/**
 * Component registration module
 * Each component registers itself using the ComponentRegistry
 */
import { ComponentRegistry } from '../core/ComponentRegistry';
import { Transform } from './Transform';
import { Visual } from './Visual';
import { TimelineComponent } from './TimelineComponent';

/**
 * Register all built-in components
 * This function should be called once during engine initialization
 */
export function registerBuiltInComponents(): void {
  const registry = ComponentRegistry.getInstance();

  // Register Transform component (every GameObject has one)
  registry.register('Transform', Transform);

  // Register Timeline component (controls animation interpolation)
  registry.register('Timeline', TimelineComponent);

  // Register Visual component (data component for visual properties)
  registry.register('Visual', Visual);

  // Future components can be added here:
  // registry.register('Physics', Physics);
  // registry.register('Collider', Collider);
  // registry.register('Script', Script);
}

