import paper from 'paper';
import { Renderer } from './Renderer';

export class RectangleRenderer extends Renderer {
  public readonly type = 'RectangleRenderer';
  public width: number;
  public height: number;

  constructor(gameObject: any, scope: paper.PaperScope, layer: paper.Layer, config?: any) {
    super(gameObject, scope, layer);
    this.width = config?.width || 100;
    this.height = config?.height || 100;
    this.fillColor = config?.fillColor;
    this.strokeColor = config?.strokeColor || '#1890ff';
    this.strokeWidth = config?.strokeWidth || 2;
  }

  createPaperItem(): paper.Item {
    const transform = this.gameObject.transform;
    const rect = new this.scope.Path.Rectangle({
      point: new this.scope.Point(
        transform.position.x - this.width / 2,
        transform.position.y - this.height / 2
      ),
      size: new this.scope.Size(this.width, this.height),
    });

    if (this.fillColor) {
      rect.fillColor = new this.scope.Color(this.fillColor);
    }
    if (this.strokeColor) {
      rect.strokeColor = new this.scope.Color(this.strokeColor);
    }
    if (this.strokeWidth !== undefined) {
      rect.strokeWidth = this.strokeWidth;
    }

    return rect;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      width: this.width,
      height: this.height,
    };
  }
}

