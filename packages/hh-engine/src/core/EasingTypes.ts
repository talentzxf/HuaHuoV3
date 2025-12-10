/**
 * Easing function types for animation interpolation
 */
export enum EasingType {
  Linear = 'linear',
  EaseIn = 'easeIn',
  EaseOut = 'easeOut',
  EaseInOut = 'easeInOut',
  // Future: Custom Bezier curve
  Custom = 'custom'
}

/**
 * Easing function interface
 */
export type EasingFunction = (t: number) => number;

/**
 * Built-in easing functions
 */
export const EasingFunctions: Record<EasingType, EasingFunction> = {
  [EasingType.Linear]: (t: number) => t,

  [EasingType.EaseIn]: (t: number) => t * t,

  [EasingType.EaseOut]: (t: number) => t * (2 - t),

  [EasingType.EaseInOut]: (t: number) => {
    if (t < 0.5) {
      return 2 * t * t;
    } else {
      return -1 + (4 - 2 * t) * t;
    }
  },

  // Custom will be handled by bezier curve parameters
  [EasingType.Custom]: (t: number) => t
};

/**
 * Bezier curve control points for custom easing
 */
export interface BezierCurve {
  p1x: number;
  p1y: number;
  p2x: number;
  p2y: number;
}

/**
 * Cubic bezier easing function
 * @param p1x - First control point x (0-1)
 * @param p1y - First control point y (0-1)
 * @param p2x - Second control point x (0-1)
 * @param p2y - Second control point y (0-1)
 */
export function createBezierEasing(p1x: number, p1y: number, p2x: number, p2y: number): EasingFunction {
  // Simple implementation - can be replaced with more accurate cubic bezier solver
  return (t: number) => {
    // Linear approximation for now
    // TODO: Implement proper cubic bezier solver
    const mt = 1 - t;
    const mt2 = mt * mt;
    const t2 = t * t;

    return 3 * mt2 * t * p1y + 3 * mt * t2 * p2y + t * t * t;
  };
}

