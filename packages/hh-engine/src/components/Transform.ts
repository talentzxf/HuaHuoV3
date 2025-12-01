import { ITransform } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { Component } from './Component';

/**
 * Transform component - stores position, rotation, and scale
 * All data is stored in Redux Store, properties are auto-synced via Proxy
 */
export class Transform extends Component implements ITransform {
  public readonly type = 'Transform';

  // Declare properties - Proxy will automatically sync with Redux Store
  // These are initialized in constructor via config, so they're never actually undefined
  position!: { x: number; y: number };
  rotation!: number;
  scale!: { x: number; y: number };

  constructor(gameObject: IGameObject, config?: {
    position?: { x: number; y: number };
    rotation?: number;
    scale?: { x: number; y: number };
  }) {
    super(gameObject, config || {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 }
    });

    // Initialize properties with defaults if not provided
    // The Proxy will sync these with Redux Store
    if (!this.position) this.position = { x: 0, y: 0 };
    if (this.rotation === undefined) this.rotation = 0;
    if (!this.scale) this.scale = { x: 1, y: 1 };
  }

  /**
   * Apply transform properties to renderer
   * This is called by ReduxAdapter when props change
   */
  applyToRenderer(renderer: any, renderItem: any): void {
    if (renderer.updateItemTransform) {
      renderer.updateItemTransform(renderItem, {
        position: this.position,
        rotation: this.rotation,
        scale: this.scale
      });
    }
  }
}

