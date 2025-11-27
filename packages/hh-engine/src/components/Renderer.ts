import paper from 'paper';
import { IRenderer } from '../core/IComponent';
import { Component } from './Component';

export abstract class Renderer extends Component implements IRenderer {
  public fillColor?: string;
  public strokeColor?: string;
  public strokeWidth?: number;

  protected paperItem: paper.Item | null = null;
  protected scope: paper.PaperScope;
  protected layer: paper.Layer;

  constructor(gameObject: any, scope: paper.PaperScope, layer: paper.Layer) {
    super(gameObject);
    this.scope = scope;
    this.layer = layer;
  }

  abstract createPaperItem(): paper.Item;

  onAdd(): void {
    this.paperItem = this.createPaperItem();
    if (this.paperItem) {
      this.paperItem.addTo(this.layer);
      this.onTransformChanged();
    }
  }

  onRemove(): void {
    if (this.paperItem) {
      this.paperItem.remove();
      this.paperItem = null;
    }
  }

  onTransformChanged(): void {
    if (!this.paperItem) return;

    const transform = this.gameObject.transform;
    const scope = this.scope;

    this.paperItem.position = new scope.Point(transform.position.x, transform.position.y);
    this.paperItem.rotation = transform.rotation;
    this.paperItem.scaling = new scope.Point(transform.scale.x, transform.scale.y);
  }

  getPaperItem(): paper.Item | null {
    return this.paperItem;
  }

  toJSON(): any {
    return {
      ...super.toJSON(),
      fillColor: this.fillColor,
      strokeColor: this.strokeColor,
      strokeWidth: this.strokeWidth,
    };
  }
}

