import { ITransform } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { ComponentBase } from './ComponentBase';
import { PropertyConfig, Component } from '../core/PropertyConfig';

/**
 * Transform component - stores position, rotation, and scale
 * All data is stored in Redux Store, properties are auto-synced via Proxy
 */
@Component
export class Transform extends ComponentBase implements ITransform {
  public readonly type = 'Transform';

  // Declare properties with metadata decorators
  position!: { x: number; y: number };

  @PropertyConfig({ step: 1, min: -360, max: 360, precision: 0 })
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
    console.debug('[Transform] applyToRenderer called with:', {
      position: this.position,
      rotation: this.rotation,
      scale: this.scale
    });

    if (renderer.updateItemTransform) {
      renderer.updateItemTransform(renderItem, {
        position: this.position,
        rotation: this.rotation,
        scale: this.scale
      });
      console.debug('[Transform] updateItemTransform completed');
    } else {
      console.warn('[Transform] renderer.updateItemTransform not available');
    }
  }
}



