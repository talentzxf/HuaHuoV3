import { ITransform } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { Component } from './Component';

export class Transform extends Component implements ITransform {
  public readonly type = 'Transform';

  private _position: { x: number; y: number };
  private _rotation: number = 0;
  private _scale: { x: number; y: number };

  constructor(gameObject: IGameObject) {
    super(gameObject);
    this._position = { x: 0, y: 0 };
    this._scale = { x: 1, y: 1 };
  }

  get position(): { x: number; y: number } {
    return this._position;
  }

  set position(value: { x: number; y: number }) {
    this._position = { ...value };
  }

  get rotation(): number {
    return this._rotation;
  }

  set rotation(value: number) {
    this._rotation = value;
  }

  get scale(): { x: number; y: number } {
    return this._scale;
  }

  set scale(value: { x: number; y: number }) {
    this._scale = { ...value };
  }

  // TODO: Move transform data to Redux Store
  // Currently storing locally for simplicity, but should be in store for proper data/behavior separation
}

