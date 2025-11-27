import paper from 'paper';
import { Renderer } from './Renderer';

export class CircleRenderer extends Renderer {
  public readonly type = 'CircleRenderer';
  public radius: number;

  constructor(gameObject: any, scope: paper.PaperScope, layer: paper.Layer, config?: any) {
    super(gameObject, scope, layer);
    this.radius = config?.radius || 50;
    this.fillColor = config?.fillColor;
    this.strokeColor = config?.strokeColor || '#1890ff';
    this.strokeWidth = config?.strokeWidth || 2;
  }

  createPaperItem(): paper.Item {
    const transform = this.gameObject.transform;
    const circle = new this.scope.Path.Circle({
      center: new this.scope.Point(transform.position.x, transform.position.y),
      radius: this.radius,
    });

    if (this.fillColor) {
      circle.fillColor = new this.scope.Color(this.fillColor);
    }
    if (this.strokeColor) {
      circle.strokeColor = new this.scope.Color(this.strokeColor);
    }
    if (this.strokeWidth !== undefined) {
      circle.strokeWidth = this.strokeWidth;
    }

    return circle;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      radius: this.radius,
    };
  }
}

