import { ILayer } from './ILayer';
import paper from 'paper';

export interface IScene {
  readonly name: string;
  readonly layers: ReadonlyArray<ILayer>;

  addLayer(name: string, paperLayer?: paper.Layer): ILayer;
  // removeLayer(layer: ILayer): void;
  getLayerByName(name: string): ILayer | undefined;

  destroy(): void;
}

