import { Renderer } from './Renderer';
import { IRenderer } from '../renderer';

export class CircleRenderer extends Renderer {
  public readonly type = 'CircleRenderer';
  public radius: number;

  constructor(gameObject: any, renderer: IRenderer, layerContext: any, config?: any) {
    super(gameObject, renderer, layerContext);
    this.radius = config?.radius || 50;
    this.fillColor = config?.fillColor;
    this.strokeColor = config?.strokeColor || '#1890ff';
    this.strokeWidth = config?.strokeWidth || 2;
  }

  createRenderItem(): any {
    const transform = this.gameObject.transform;
    return this.renderer.createRenderItem(this.layerContext, 'circle', {
      x: transform.position.x,
      y: transform.position.y,
      radius: this.radius,
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
    });
  }
}

