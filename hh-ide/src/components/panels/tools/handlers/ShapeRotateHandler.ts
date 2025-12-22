import { TransformHandlerBase } from './TransformHandlerBase';
import { getEngineStore } from '@huahuo/engine';
import { updateComponentPropsWithKeyFrame } from '@huahuo/sdk';
import paper from 'paper';

/**
 * ShapeRotateHandler
 * Handles rotation transformation of GameObjects
 * Updates Redux store with keyframes during drag
 */
export class ShapeRotateHandler extends TransformHandlerBase {
  private transformComponentIds: Map<string, string> = new Map(); // Cache component IDs
  private rotationCenter: { x: number; y: number } | null = null; // Rotation pivot point
  private lastAngle: number = 0; // Last angle for incremental rotation
  private totalRotation: number = 0; // Total rotation during this drag
  private initialRotations: Map<string, number> = new Map(); // Store initial rotations

  // Visual feedback for rotation
  private rotationIndicator: paper.PathItem[] = [];
  private readonly INDICATOR_RADIUS_SMALL = 20;
  private readonly INDICATOR_RADIUS_BIG = 25;
  private readonly INDICATOR_RADIUS_STEP = 6;

  // Snap to angle when shift is pressed
  private pressingShift: boolean = false;
  private readonly SNAP_ANGLE_DEGREE = 10; // Snap every 10 degrees

  constructor() {
    super();

    // Listen for shift key for angle snapping
    document.body.addEventListener('keydown', this.onKeyDown.bind(this));
    document.body.addEventListener('keyup', this.onKeyUp.bind(this));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.shiftKey) {
      this.pressingShift = true;
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    if (!e.shiftKey) {
      this.pressingShift = false;
    }
  }

  protected onBeginMove(position: { x: number; y: number }): void {
    // Store initial rotations and component IDs of all target GameObjects
    this.initialRotations.clear();
    this.transformComponentIds.clear();

    const engineStore = getEngineStore();
    const state = engineStore.getState();
    const engineState = state.engine || state;

    // Calculate rotation center (pivot point) - center of all selected objects
    let sumX = 0;
    let sumY = 0;
    let count = 0;

    this.targetGameObjects.forEach(gameObjectId => {
      const gameObject = engineState.gameObjects.byId[gameObjectId];
      if (gameObject && gameObject.componentIds.length > 0) {
        // Find Transform component (should be first component)
        const transformComponentId = gameObject.componentIds[0];
        const transformComponent = engineState.components.byId[transformComponentId];

        if (transformComponent && transformComponent.type === 'Transform') {
          // Store initial rotation
          this.initialRotations.set(gameObjectId, transformComponent.props.rotation || 0);
          // Cache the transform component ID
          this.transformComponentIds.set(gameObjectId, transformComponentId);

          // Accumulate position for center calculation
          const pos = transformComponent.props.position;
          sumX += pos.x;
          sumY += pos.y;
          count++;
        }
      }
    });

    // Calculate rotation center as the average position of all objects
    // TODO: In the future, this will be customizable by the user
    if (count > 0) {
      this.rotationCenter = {
        x: sumX / count,
        y: sumY / count
      };
    } else {
      this.rotationCenter = position;
    }

    // Calculate initial angle from rotation center to start position
    this.lastAngle = this.calculateAngle(position);
    this.totalRotation = 0;

    // TODO: Show status bar prompt
    // setPrompt(i18n.t("statusbar.rotateShape"))
  }

  protected onDragging(position: { x: number; y: number }): void {
    if (!this.rotationCenter || !this.startPosition) return;

    // Calculate current angle
    const currentAngle = this.calculateAngle(position);

    // Calculate delta angle (incremental rotation)
    let deltaAngle = currentAngle - this.lastAngle;

    // Normalize angle to [-180, 180] range
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    // Update total rotation
    this.totalRotation += deltaAngle;

    // Determine the actual rotation to apply (with or without snapping)
    let effectiveRotation = this.totalRotation;
    if (this.pressingShift) {
      effectiveRotation = Math.round(this.totalRotation / this.SNAP_ANGLE_DEGREE) * this.SNAP_ANGLE_DEGREE;
    }

    // Update Redux store with new rotations and create keyframes
    this.targetGameObjects.forEach(gameObjectId => {
      const initialRotation = this.initialRotations.get(gameObjectId);
      const transformComponentId = this.transformComponentIds.get(gameObjectId);

      if (initialRotation === undefined || !transformComponentId) return;

      // Calculate new rotation: initial + effective rotation delta
      const newRotation = initialRotation + effectiveRotation;

      const engineStore = getEngineStore();
      // Update rotation and add keyframe automatically
      (engineStore.dispatch as any)(updateComponentPropsWithKeyFrame({
        id: transformComponentId,
        patch: {
          rotation: newRotation
        }
      }));
    });

    // Update last angle for next drag event
    this.lastAngle = currentAngle;

    // Draw rotation indicator
    this.drawRotationIndicator(this.rotationCenter, this.totalRotation);
  }

  protected onEndMove(): void {
    // Clear rotation indicator
    this.clearRotationIndicator();

    // Clean up state
    this.initialRotations.clear();
    this.transformComponentIds.clear();
    this.rotationCenter = null;
    this.lastAngle = 0;
    this.totalRotation = 0;

    // Note: Keyframes have already been created during dragging via updateComponentPropsWithKeyFrame
    // No need to create additional undo/redo command here unless we implement a custom undo system
  }

  /**
   * Calculate angle from rotation center to a point
   * Returns angle in degrees
   */
  private calculateAngle(point: { x: number; y: number }): number {
    if (!this.rotationCenter) return 0;

    const dx = point.x - this.rotationCenter.x;
    const dy = point.y - this.rotationCenter.y;

    // atan2 returns angle in radians, convert to degrees
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  /**
   * Clear rotation indicator visual feedback
   */
  private clearRotationIndicator(): void {
    for (const shape of this.rotationIndicator) {
      shape.remove();
    }
    this.rotationIndicator = [];
  }

  /**
   * Draw rotation indicator visual feedback
   */
  private drawRotationIndicator(center: { x: number; y: number }, degreesRotated: number): void {
    this.clearRotationIndicator();

    const position = new paper.Point(center.x, center.y);

    // Calculate full circles and residual
    const circles = degreesRotated > 0
      ? Math.floor(degreesRotated / 360)
      : Math.ceil(degreesRotated / 360);
    const residual = degreesRotated - circles * 360;

    let radius1 = this.INDICATOR_RADIUS_SMALL;
    let radius2 = this.INDICATOR_RADIUS_BIG;

    const fillColor = degreesRotated > 0
      ? new paper.Color('yellow')
      : new paper.Color('red');

    // Draw full circles
    for (let i = 0; i < Math.abs(circles); i++) {
      const donut = this.drawDonut(position, radius1, radius2, 0, 360);
      donut.fillColor = fillColor;
      this.rotationIndicator.push(donut);

      radius1 += this.INDICATOR_RADIUS_STEP;
      radius2 += this.INDICATOR_RADIUS_STEP;
    }

    // Draw residual arc
    if (Math.abs(residual) > 0.1) {
      const startAngle = this.calculateAngle(this.startPosition!);
      const endAngle = startAngle + residual;

      const residualDonut = this.drawDonut(position, radius1, radius2, startAngle, endAngle);
      residualDonut.fillColor = fillColor;
      this.rotationIndicator.push(residualDonut);
    }
  }

  /**
   * Draw a donut shape (ring) between two radii
   */
  private drawDonut(
    position: paper.Point,
    radiusSmall: number,
    radiusBig: number,
    startAngle: number = 0,
    endAngle: number = 360
  ): paper.PathItem {
    const p1 = this.drawFanShape(position, radiusSmall, startAngle, endAngle);
    const p2 = this.drawFanShape(position, radiusBig, startAngle, endAngle);

    const donut = p2.subtract(p1) as paper.PathItem;

    p1.remove();
    p2.remove();

    return donut;
  }

  /**
   * Draw a fan/arc shape
   */
  private drawFanShape(
    position: paper.Point,
    radius: number,
    startAngle: number,
    endAngle: number
  ): paper.Path {
    // Full circle case
    if (startAngle === 0 && endAngle === 360) {
      return new paper.Path.Circle(position, radius);
    }

    // Convert degrees to radians
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    const midAngleRad = (endAngleRad - startAngleRad) / 2 + startAngleRad;

    // Calculate arc points
    const startPoint = new paper.Point(
      position.x + radius * Math.cos(startAngleRad),
      position.y + radius * Math.sin(startAngleRad)
    );
    const midPoint = new paper.Point(
      position.x + radius * Math.cos(midAngleRad),
      position.y + radius * Math.sin(midAngleRad)
    );
    const endPoint = new paper.Point(
      position.x + radius * Math.cos(endAngleRad),
      position.y + radius * Math.sin(endAngleRad)
    );

    // Create arc path
    const fanShape = new paper.Path.Arc(startPoint, midPoint, endPoint);
    fanShape.add(position); // Add center point to close the fan
    fanShape.closed = true;

    return fanShape;
  }

  /**
   * Clean up event listeners
   */
  public destroy(): void {
    document.body.removeEventListener('keydown', this.onKeyDown.bind(this));
    document.body.removeEventListener('keyup', this.onKeyUp.bind(this));
    this.clearRotationIndicator();
  }
}

// Singleton instance
export const shapeRotateHandler = new ShapeRotateHandler();

