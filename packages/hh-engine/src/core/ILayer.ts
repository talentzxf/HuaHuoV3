import { IGameObject } from './IGameObject';

export interface ILayer {
  readonly id: string;
  readonly name: string;
  readonly gameObjects: ReadonlyArray<IGameObject>;
  visible: boolean;
  locked: boolean;

  addGameObject(name: string): IGameObject;
  removeGameObject(gameObject: IGameObject): void;
  findGameObject(name: string): IGameObject | undefined;

  destroy(): void;
}

