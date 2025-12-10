import { IComponent } from '../core/IComponent';
import { IGameObject } from '../core/IGameObject';
import { ComponentBase } from './ComponentBase';
import { Component } from '../core/PropertyConfig';
import { EasingType } from '../core/EasingTypes';
import { getEngineState, getEngineStore } from '../core/EngineGlobals';
import { setKeyFrameEasing } from '../store/ComponentSlice';

/**
 * Animation segment represents interpolation between two keyframes
 * This is a computed/derived data structure, not stored in Redux
 */
export interface AnimationSegment {
  componentId: string;
  componentType: string;
  propertyName: string;
  startFrame: number;
  endFrame: number;
  easingType: EasingType;
}

/**
 * Timeline component - UI helper for managing animation easing
 * This component doesn't store any data itself - it just provides
 * methods to collect and edit easing information from other components' keyframes
 *
 * Note: The @PropertyRenderer decorator is applied in the IDE layer
 * to avoid circular dependencies (TimelineComponent -> PropertyRenderer -> TimelineComponent)
 */
@Component
export class TimelineComponent extends ComponentBase implements IComponent {
  public readonly type = 'Timeline';

  constructor(gameObject: IGameObject, config?: any) {
    super(gameObject, config || {});
  }

  /**
   * Collect all animation segments from all components of this GameObject
   * This reads keyframes from all components and returns segment information
   */
  collectAnimationSegments(): AnimationSegment[] {
    const state = getEngineState();
    const gameObject = state.gameObjects.byId[this.gameObject.id];
    if (!gameObject) return [];

    const segments: AnimationSegment[] = [];

    // Iterate through all components
    for (const componentId of gameObject.componentIds) {
      const component = state.components.byId[componentId];
      if (!component) continue;

      // Skip Timeline component itself
      if (component.type === 'Timeline') continue;

      // Iterate through all properties with keyframes
      for (const propertyName in component.keyFrames) {
        const keyFrames = component.keyFrames[propertyName];
        if (keyFrames.length < 2) continue; // Need at least 2 keyframes to make a segment

        // Create segments between consecutive keyframes
        for (let i = 0; i < keyFrames.length - 1; i++) {
          const startFrame = keyFrames[i].frame;
          const endFrame = keyFrames[i + 1].frame;

          // Easing is stored on the END keyframe (easing TO that keyframe)
          const easingType = keyFrames[i + 1].easingType || EasingType.Linear;

          segments.push({
            componentId,
            componentType: component.type,
            propertyName,
            startFrame,
            endFrame,
            easingType
          });
        }
      }
    }

    return segments;
  }

  /**
   * Set easing type for a specific animation segment
   * This dispatches an action to update the keyframe's easing
   */
  setSegmentEasing(
    componentId: string,
    propertyName: string,
    startFrame: number,
    endFrame: number,
    easingType: EasingType
  ): void {
    const store = getEngineStore();

    // Set easing on the END keyframe (easing TO that keyframe)
    store.dispatch(setKeyFrameEasing({
      componentId,
      propName: propertyName,
      frame: endFrame,
      easingType
    }));
  }

  /**
   * Timeline component doesn't need to apply anything to renderer
   */
  applyToRenderer(renderer: any, renderItem: any): void {
    // No-op: Timeline is just a UI helper
  }
}

