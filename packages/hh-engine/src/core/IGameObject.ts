import { IComponent, ITransform } from './IComponent';

export interface IGameObject {
  readonly id: string;
  readonly name: string;
  readonly transform: ITransform;
  active: boolean;

  addComponent<T extends IComponent>(componentType: string, config?: any): T;
  getComponent<T extends IComponent>(componentType: string): T | undefined;
  getComponents<T extends IComponent>(componentType: string): T[];
  removeComponent(component: IComponent): void;

  update(deltaTime: number): void;
  destroy(): void;

  // Note: toJSON removed - serialization should be handled by Redux Store
  // GameObject is a behavior object, not a data container
}

