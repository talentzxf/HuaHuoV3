import { IComponent } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { ComponentBase } from './ComponentBase';
import { Component } from '../core/PropertyConfig';
import { EasingType } from '../core/EasingTypes';
import { getKernel } from '../core/KernelBridge';

export interface AnimationSegment {
  componentId: string;
  componentType: string;
  propertyName: string;
  startFrame: number;
  endFrame: number;
  easingType: EasingType;
}

/**
 * Timeline component — UI helper for managing animation easing.
 * Reads keyframes directly from the Rust kernel.
 */
@Component
export class TimelineComponent extends ComponentBase implements IComponent {
  public readonly type = 'Timeline';

  constructor(gameObject: IGameObject, config?: any) {
    super(gameObject, config || {});
  }

  collectAnimationSegments(): AnimationSegment[] {
    const kernel = getKernel();
    if (!kernel.ready) return [];

    const go = kernel.getGameObject(this.gameObject.id);
    if (!go) return [];

    const segments: AnimationSegment[] = [];

    for (const [compType, compData] of Object.entries(go.components ?? {})) {
      const cd = compData as any;
      if (compType === 'Timeline') continue;
      for (const propertyName in cd.keyFrames ?? {}) {
        const keyFrames: any[] = cd.keyFrames[propertyName];
        if (!Array.isArray(keyFrames) || keyFrames.length < 2) continue;
        for (let i = 0; i < keyFrames.length - 1; i++) {
          segments.push({
            componentId: `${this.gameObject.id}_${compType}`,
            componentType: compType,
            propertyName,
            startFrame: keyFrames[i].frame,
            endFrame: keyFrames[i + 1].frame,
            easingType: keyFrames[i + 1].easing ?? EasingType.Linear,
          });
        }
      }
    }
    return segments;
  }

  setSegmentEasing(
    _componentId: string,
    propertyName: string,
    _startFrame: number,
    endFrame: number,
    easingType: EasingType,
    componentType: string
  ): void {
    const kernel = getKernel();
    if (!kernel.ready) return;
    kernel.setKeyframe(this.gameObject.id, componentType, propertyName, endFrame, undefined, easingType);
  }

  applyToRenderer(_renderer: any, _renderItem: any): void {}
}
