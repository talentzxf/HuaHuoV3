import { TransformHandlerBase } from './TransformHandlerBase';
import { shapeTranslateHandler } from './ShapeTranslateHandler';

/**
 * TransformHandlerMap
 * Maps hit types to their corresponding transform handlers
 */
export class TransformHandlerMap {
  static defaultTransformHandler: TransformHandlerBase = shapeTranslateHandler;

  private handlerMap: Map<string, TransformHandlerBase> = new Map();

  constructor() {
    // Register default handlers
    this.registerHandler('fill', shapeTranslateHandler);
    this.registerHandler('stroke', shapeTranslateHandler);
    this.registerHandler('bounds', shapeTranslateHandler);
  }

  /**
   * Register a handler for a specific hit type
   */
  registerHandler(hitType: string, handler: TransformHandlerBase): void {
    this.handlerMap.set(hitType, handler);
  }

  /**
   * Get handler for a specific hit type
   */
  getHandler(hitType: string): TransformHandlerBase {
    return this.handlerMap.get(hitType) || TransformHandlerMap.defaultTransformHandler;
  }
}

export { TransformHandlerBase };
export { shapeTranslateHandler } from './ShapeTranslateHandler';

