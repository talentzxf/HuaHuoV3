import { IRendererComponent } from '../core/IComponent';
import { Component } from './Component';
import { IRenderer } from '../renderer';

export abstract class Renderer extends Component implements IRendererComponent {
  public fillColor?: string;
  public strokeColor?: string;
  public strokeWidth?: number;

  protected renderItem: any | null = null;
  protected renderer: IRenderer;
  protected layerContext: any;

  constructor(gameObject: any, renderer: IRenderer, layerContext: any) {
    super(gameObject);
    this.renderer = renderer;
    this.layerContext = layerContext;
  }

  abstract createRenderItem(): any;

  onAdd(): void {
    this.renderItem = this.createRenderItem();
    if (this.renderItem) {
      this.onTransformChanged();
    }
  }

  onRemove(): void {
    if (this.renderItem) {
      this.renderer.removeRenderItem(this.renderItem);
      this.renderItem = null;
    }
  }

  onTransformChanged(): void {
    if (!this.renderItem) return;

    const transform = this.gameObject.transform;
    this.renderer.updateItemTransform(this.renderItem, {
      position: transform.position,
      rotation: transform.rotation,
      scale: transform.scale,
    });
  }

  getRenderItem(): any | null {
    return this.renderItem;
  }

  // TODO: Renderer properties (fillColor, strokeColor, etc.) should be stored in Redux Store
  // Currently stored locally but should follow data/behavior separation principle
}

