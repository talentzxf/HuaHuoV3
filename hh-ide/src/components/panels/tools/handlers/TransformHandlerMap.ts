import { TransformHandlerBase } from './TransformHandlerBase';
import { shapeTranslateHandler } from './ShapeTranslateHandler';
import { shapeRotateHandler } from './ShapeRotateHandler';
import {
  shapeScaleHandler,
  shapeHorizontalScaleHandler,
  shapeVerticalScaleHandler
} from './ShapeScaleHandler';

/**
 * TransformHandlerMap
 * Maps hit types to their corresponding transform handlers
 */
export class TransformHandlerMap {
  static defaultTransformHandler: TransformHandlerBase = shapeTranslateHandler;

  private handlerMap: Map<string, TransformHandlerBase> = new Map();

  constructor() {
    // Register default handlers for translation
    this.registerHandler('fill', shapeTranslateHandler);
    this.registerHandler('stroke', shapeTranslateHandler);
    this.registerHandler('bounds', shapeTranslateHandler);

    // Register rotation handler
    this.registerHandler('rotation', shapeRotateHandler);

    // Register scale handlers
    this.registerHandler('corner', shapeScaleHandler); // Corner handles - uniform scaling
    this.registerHandler('edge-horizontal', shapeHorizontalScaleHandler); // Left/Right edges
    this.registerHandler('edge-vertical', shapeVerticalScaleHandler); // Top/Bottom edges
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
export { shapeRotateHandler } from './ShapeRotateHandler';
export {
  shapeScaleHandler,
  shapeHorizontalScaleHandler,
  shapeVerticalScaleHandler
} from './ShapeScaleHandler';
