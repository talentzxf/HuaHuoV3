import { ILayer } from './ILayer';

export interface IScene {
  readonly name: string;
  readonly layers: ReadonlyArray<ILayer>;

  addLayer(name: string): ILayer;
  removeLayer(layer: ILayer): void;
  getLayer(name: string): ILayer | undefined;

  destroy(): void;
  toJSON(): any;
}

