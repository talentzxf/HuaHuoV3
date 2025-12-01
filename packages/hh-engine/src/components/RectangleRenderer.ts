import { Renderer } from './Renderer';
import { IRenderer } from '../renderer';

export class RectangleRenderer extends Renderer {
  public readonly type = 'RectangleRenderer';
  public width: number;
  public height: number;

  constructor(gameObject: any, renderer: IRenderer, layerContext: any, config?: any) {
    super(gameObject, renderer, layerContext);
    this.width = config?.width || 100;
    this.height = config?.height || 100;
    this.fillColor = config?.fillColor;
    this.strokeColor = config?.strokeColor || '#1890ff';
    this.strokeWidth = config?.strokeWidth || 2;
  }

  createRenderItem(): any {
    const transform = this.gameObject.transform;
    return this.renderer.createRenderItem(this.layerContext, 'rectangle', {
      x: transform.position.x,
      y: transform.position.y,
      width: this.width,
      height: this.height,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
    });
  }
}

