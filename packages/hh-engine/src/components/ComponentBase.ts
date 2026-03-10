import { IComponent } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { getKernel } from '../core/KernelBridge';
import { createComponentProxy } from '../core/ComponentProxy';
import { InstanceRegistry } from "../core/InstanceRegistry";

export abstract class ComponentBase implements IComponent {
  public enabled: boolean = true;
  public abstract readonly type: string;

  protected gameObject: IGameObject;
  /** In the Kernel model, componentId = `${goId}_${type}` (synthetic key). */
  protected componentId: string | null = null;

  constructor(gameObject: IGameObject, config?: Record<string, any>) {
    this.gameObject = gameObject;
    return createComponentProxy(this, config);
  }

  onAdd(): void {
    // Synthetic ID: goId + type is sufficient to address this component in the kernel
    this.componentId = `${this.gameObject.id}_${this.type}`;
    InstanceRegistry.getInstance().register(this.componentId, this);
  }

  onRemove(): void {
    if (this.componentId) {
      InstanceRegistry.getInstance().unregister(this.componentId);
    }
  }

  update(_deltaTime: number): void {}

  applyToRenderer(_renderer: any, _renderItem: any): void {}

  /** Read current interpolated props from the kernel at the current frame. */
  protected getProps(): Record<string, any> {
    const kernel = getKernel();
    if (!kernel.ready || !this.gameObject.id) return {};
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;
    const allProps = kernel.getInterpolatedProps(this.gameObject.id, frame);
    return allProps?.[this.type] ?? {};
  }

  /** Write a single prop as a keyframe at the current frame. */
  protected updateProp(key: string, value: any): void {
    const kernel = getKernel();
    if (!kernel.ready) return;
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;
    kernel.setKeyframe(this.gameObject.id, this.type, key, frame, value);
  }

  /** Write multiple props as keyframes at the current frame. */
  protected updateProps(patch: Record<string, any>): void {
    const kernel = getKernel();
    if (!kernel.ready) return;
    const frame = kernel.getPlaybackState()?.current_frame ?? 0;
    for (const [key, value] of Object.entries(patch)) {
      kernel.setKeyframe(this.gameObject.id, this.type, key, frame, value);
    }
  }
}
