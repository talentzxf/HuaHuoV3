import { IComponent } from '../core/IComponent';
import { Component } from './Component';

/**
 * Visual component - stores visual properties (colors, stroke, etc.)
 * All data is stored in Redux Store, properties are auto-synced via Proxy
 */
export class Visual extends Component implements IComponent {
  public readonly type = 'Visual';

  // Declare properties - Proxy will automatically sync with Redux Store
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
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
    if (renderer.updateItemVisual) {
      renderer.updateItemVisual(renderItem, {
        fillColor: this.fillColor,
        strokeColor: this.strokeColor,
        strokeWidth: this.strokeWidth,
        opacity: this.opacity
      });
    }
  }
}

