import { IComponent, ITransform } from './IComponent';

export interface IGameObject {
  readonly name: string;
  readonly transform: ITransform;
  active: boolean;

  addComponent<T extends IComponent>(componentType: string, config?: any): T;
  getComponent<T extends IComponent>(componentType: string): T | undefined;
  getComponents<T extends IComponent>(componentType: string): T[];
  removeComponent(component: IComponent): void;

  destroy(): void;
  toJSON(): any;
}

