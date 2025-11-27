import { IComponent } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';

export abstract class Component implements IComponent {
  public enabled: boolean = true;
  public abstract readonly type: string;

  protected gameObject: IGameObject;

  constructor(gameObject: IGameObject) {
    this.gameObject = gameObject;
  }

  // Lifecycle methods
  onAdd(): void {}
  onRemove(): void {}
  update(deltaTime: number): void {}

  toJSON(): any {
    return {
      type: this.type,
      enabled: this.enabled,
    };
  }
}

