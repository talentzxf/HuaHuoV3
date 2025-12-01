/**
 * Component registration module
 * Each component registers itself using the ComponentRegistry
 */
import { ComponentRegistry } from '../core/ComponentRegistry';
import { CircleRenderer } from './CircleRenderer';
import { RectangleRenderer } from './RectangleRenderer';
import { IRenderer } from '../renderer';

/**
 * Register all built-in components
 * This function should be called once during engine initialization
 */
export function registerBuiltInComponents(renderer: IRenderer): void {
  const registry = ComponentRegistry.getInstance();

  // Register CircleRenderer
  registry.register('CircleRenderer', (gameObject: any, layerContext: any, config: any) => {
    return new CircleRenderer(gameObject, renderer, layerContext, config);
  });

  // Register RectangleRenderer
  registry.register('RectangleRenderer', (gameObject: any, layerContext: any, config: any) => {
    return new RectangleRenderer(gameObject, renderer, layerContext, config);
  });

  // Future components can be added here:
  // registry.register('LineRenderer', ...);
  // registry.register('TextRenderer', ...);
}

