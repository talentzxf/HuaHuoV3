import { IGameObject } from '../core/IGameObject';
import { ComponentBase } from './ComponentBase';
import { PropertyConfig, Component } from '../core/PropertyConfig';

/**
 * Visual component - stores visual properties (colors, stroke, etc.)
 * All data is stored in Redux Store, properties are auto-synced via Proxy
 */
@Component
export class Visual extends ComponentBase {
  public readonly type = 'Visual';

  // Declare properties with metadata decorators
  fillColor?: string;
  strokeColor?: string;

  @PropertyConfig({ step: 0.5, min: 0, max: 100, precision: 1 })
  strokeWidth?: number;

  @PropertyConfig({ step: 0.05, min: 0, max: 1, precision: 2 })
  opacity?: number;

  constructor(gameObject: any, config?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  }) {
    super(gameObject, config);
    // Base class automatically wraps this with a Proxy
  }

  /**
   * Apply visual properties to renderer
   * This is called by ReduxAdapter when props change
   */
  applyToRenderer(renderer: any, renderItem: any): void {
    console.debug('[Visual] applyToRenderer called with:', {
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
      opacity: this.opacity
    });

    if (renderer.updateItemVisual) {
      renderer.updateItemVisual(renderItem, {
        fillColor: this.fillColor,
        strokeColor: this.strokeColor,
        strokeWidth: this.strokeWidth,
        opacity: this.opacity
      });
      console.debug('[Visual] updateItemVisual completed');
    } else {
      console.warn('[Visual] renderer.updateItemVisual not available');
    }
  }
}



