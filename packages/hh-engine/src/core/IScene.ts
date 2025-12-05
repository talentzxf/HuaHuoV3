import { ILayer } from './ILayer';
import paper from 'paper';

export interface IScene {
  readonly id: string; // Scene unique identifier
  name: string; // Scene name (editable)
  readonly layers: ReadonlyArray<ILayer>;
  duration: number; // Animation duration in seconds
  fps: number; // Frames per second

  addLayer(name: string, paperLayer?: paper.Layer): ILayer;
  // removeLayer(layer: ILayer): void;
  getLayerByName(name: string): ILayer | undefined;

  destroy(): void;
}

