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

  // Note: Render item is managed by Renderer's internal registry
  // Use renderer.getRenderItem(gameObjectId) to access it
  // GameObject doesn't need direct access to its render item
}

