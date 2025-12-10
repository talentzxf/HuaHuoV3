/**
 * Register custom property renderers for components
 * This should be called once during IDE initialization
 */
import { ComponentPropertyRendererRegistry } from '@huahuo/engine';
import { TimelinePropertyRenderer } from './TimelinePropertyRenderer';

export function registerCustomPropertyRenderers() {
  const registry = ComponentPropertyRendererRegistry.getInstance();

  // Register Timeline component's custom renderer
  registry.register('Timeline', TimelinePropertyRenderer);

  // Future: Register other custom renderers here
  // registry.register('Physics', PhysicsPropertyRenderer);
  // registry.register('ParticleSystem', ParticleSystemPropertyRenderer);
}

