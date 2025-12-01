import { IComponent } from '../core/IComponent';
import { Component } from './Component';

/**
 * Visual component - stores visual properties (colors, stroke, etc.)
 * All data is stored in Redux Store, this is just a behavior wrapper
 */
export class Visual extends Component implements IComponent {
  public readonly type = 'Visual';

  constructor(gameObject: any, config?: {
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    opacity?: number;
  }) {
    super(gameObject);
    // Component data will be created in Redux Store during addComponent
    // Initial config is stored in props
  }

  get fillColor(): string | undefined {
    return this.getProps().fillColor;
  }

  set fillColor(value: string | undefined) {
    this.updateProp('fillColor', value);
  }

  get strokeColor(): string | undefined {
    return this.getProps().strokeColor;
  }

  set strokeColor(value: string | undefined) {
    this.updateProp('strokeColor', value);
  }

  get strokeWidth(): number | undefined {
    return this.getProps().strokeWidth;
  }

  set strokeWidth(value: number | undefined) {
    this.updateProp('strokeWidth', value);
  }

  get opacity(): number {
    return this.getProps().opacity ?? 1;
  }

  set opacity(value: number) {
    const clampedValue = Math.max(0, Math.min(1, value));
    this.updateProp('opacity', clampedValue);
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

