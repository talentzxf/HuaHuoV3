import paper from 'paper';

/**
 * Custom selection box with rotation support
 * Replaces Paper.js default selection which doesn't support rotation
 *
 * This is a pure UI component - it only detects user interactions
 * and returns the operation type. It does NOT handle business logic.
 */
export class RotatableSelectionBox {
  private selectedItems: Set<paper.Item> = new Set();
  private selectionGroup: paper.Group | null = null;
  private boundingBox: paper.Path.Rectangle | null = null;
  private rotationHandle: paper.Path.Circle | null = null;
  private cornerHandles: paper.Path.Circle[] = [];
  private edgeHandles: paper.Path.Circle[] = [];

  private isDragging = false;
  private isRotating = false;
  private isScaling = false;
  private dragStartPoint: paper.Point | null = null;
  private rotationCenter: paper.Point | null = null;
  private initialRotation = 0;
  private activeHandle: paper.Path.Circle | null = null;

  // Styling - similar to old ShapeSelector
  private readonly STROKE_COLOR = new paper.Color('#1890ff'); // Ant Design blue
  private readonly STROKE_WIDTH = 1.5;
  private readonly HANDLE_RADIUS = 5;
  private readonly CORNER_HANDLE_RADIUS = 6; // Slightly larger for corners
  private readonly ROTATION_HANDLE_DISTANCE = 40; // Distance from top edge
  private readonly ROTATION_HANDLE_RADIUS = 7; // Larger rotation handle
  private readonly HANDLE_FILL = new paper.Color(1, 1, 1); // White
  private readonly HANDLE_STROKE = new paper.Color('#1890ff'); // Blue
  private readonly ROTATION_HANDLE_FILL = new paper.Color('#52c41a'); // Green
  private readonly ROTATION_HANDLE_STROKE = new paper.Color('#389e0d'); // Dark green
  private readonly BOUND_MARGIN = 10; // Margin around bounds for easier grabbing

  constructor() {
    this.setupSelectionGroup();
  }

  private setupSelectionGroup(): void {
    // Create a group to hold all selection UI elements
    this.selectionGroup = new paper.Group();
    // Don't lock the group - we need to interact with handles
    // Instead, we'll skip items without gameObjectId in hit testing
    this.selectionGroup.name = 'selectionGroup';
    this.selectionGroup.data.isSelectionBox = true; // Mark as selection UI
  }

  /**
   * Set selected items and show selection box
   */
  public setSelection(items: paper.Item[]): void {
    this.clear();

    if (items.length === 0) {
      return;
    }

    items.forEach(item => this.selectedItems.add(item));
    this.updateSelectionBox();
  }

  /**
   * Add item to selection
   */
  public addToSelection(item: paper.Item): void {
    this.selectedItems.add(item);
    this.updateSelectionBox();
  }

  /**
   * Remove item from selection
   */
  public removeFromSelection(item: paper.Item): void {
    this.selectedItems.delete(item);
    if (this.selectedItems.size === 0) {
      this.clear();
    } else {
      this.updateSelectionBox();
    }
  }

  /**
   * Clear selection
   */
  public clear(): void {
    this.selectedItems.clear();
    this.hideSelectionBox();
  }

  /**
   * Get selected items
   */
  public getSelectedItems(): paper.Item[] {
    return Array.from(this.selectedItems);
  }

  /**
   * Refresh selection box to match current item bounds
   * Call this after transforms to update the selection box visuals
   */
  public refresh(): void {
    this.updateSelectionBox();
  }

  /**
   * Update selection box to match selected items' bounds
   */
  private updateSelectionBox(): void {
    if (this.selectedItems.size === 0) {
      this.hideSelectionBox();
      return;
    }

    // Calculate combined bounds of all selected items
    let combinedBounds: paper.Rectangle | null = null;
    this.selectedItems.forEach(item => {
      const itemBounds = item.bounds;
      if (!combinedBounds) {
        combinedBounds = itemBounds.clone();
      } else {
        combinedBounds = combinedBounds.unite(itemBounds) as paper.Rectangle;
      }
    });

    if (!combinedBounds) {
      return;
    }

    // Type assertion to help TypeScript
    const bounds = combinedBounds as paper.Rectangle;

    // ✅ Expand bounds by BOUND_MARGIN (like old ShapeSelector)
    // This makes it easier to grab the selection box and handles
    const expandedBounds = new paper.Rectangle(
      bounds.x - this.BOUND_MARGIN,
      bounds.y - this.BOUND_MARGIN,
      bounds.width + this.BOUND_MARGIN * 2,
      bounds.height + this.BOUND_MARGIN * 2
    );

    this.hideSelectionBox();
    this.createSelectionBox(expandedBounds);
  }

  /**
   * Create selection box with rotation handle
   */
  private createSelectionBox(bounds: paper.Rectangle): void {
    if (!this.selectionGroup) {
      this.setupSelectionGroup();
    }

    // Create bounding box rectangle with dashed stroke
    this.boundingBox = new paper.Path.Rectangle(bounds);
    this.boundingBox.strokeColor = this.STROKE_COLOR;
    this.boundingBox.strokeWidth = this.STROKE_WIDTH;
    this.boundingBox.fillColor = null;
    this.boundingBox.dashArray = [5, 3]; // More visible dash pattern
    this.boundingBox.name = 'boundingBox';
    this.boundingBox.data.isSelectionBox = true; // Mark as selection UI
    this.selectionGroup!.addChild(this.boundingBox);

    // Create corner handles (for scaling) - larger and more visible
    const corners = [
      bounds.topLeft,
      bounds.topRight,
      bounds.bottomRight,
      bounds.bottomLeft
    ];

    corners.forEach((corner, index) => {
      const handle = new paper.Path.Circle(corner, this.CORNER_HANDLE_RADIUS);
      handle.fillColor = this.HANDLE_FILL;
      handle.strokeColor = this.HANDLE_STROKE;
      handle.strokeWidth = 2;
      handle.name = `cornerHandle_${index}`;
      handle.data.handleType = 'corner';
      handle.data.cornerIndex = index;
      handle.data.isSelectionBox = true; // Mark as selection UI
      this.cornerHandles.push(handle);
      this.selectionGroup!.addChild(handle);
    });

    // Create edge handles (for scaling)
    const edges = [
      bounds.topCenter,
      bounds.rightCenter,
      bounds.bottomCenter,
      bounds.leftCenter
    ];

    edges.forEach((edge, index) => {
      const handle = new paper.Path.Circle(edge, this.HANDLE_RADIUS);
      handle.fillColor = this.HANDLE_FILL;
      handle.strokeColor = this.HANDLE_STROKE;
      handle.strokeWidth = 2;
      handle.name = `edgeHandle_${index}`;
      handle.data.handleType = 'edge';
      handle.data.edgeIndex = index;
      handle.data.isSelectionBox = true; // Mark as selection UI
      this.edgeHandles.push(handle);
      this.selectionGroup!.addChild(handle);
    });

    // Create rotation handle (above top edge) - more prominent
    const rotationPoint = new paper.Point(
      bounds.center.x,
      bounds.top - this.ROTATION_HANDLE_DISTANCE
    );
    this.rotationHandle = new paper.Path.Circle(rotationPoint, this.ROTATION_HANDLE_RADIUS);
    this.rotationHandle.fillColor = this.ROTATION_HANDLE_FILL;
    this.rotationHandle.strokeColor = this.ROTATION_HANDLE_STROKE;
    this.rotationHandle.strokeWidth = 2;
    this.rotationHandle.name = 'rotationHandle';
    this.rotationHandle.data.handleType = 'rotation';
    this.rotationHandle.data.isSelectionBox = true; // Mark as selection UI
    this.selectionGroup!.addChild(this.rotationHandle);

    // Create line connecting rotation handle to top edge
    const connectionLine = new paper.Path.Line(
      bounds.topCenter,
      rotationPoint
    );
    connectionLine.strokeColor = this.STROKE_COLOR;
    connectionLine.strokeWidth = 1;
    connectionLine.dashArray = [3, 3];
    connectionLine.name = 'rotationLine';
    connectionLine.data.isSelectionBox = true; // Mark as selection UI
    this.selectionGroup!.addChild(connectionLine);

    // Store rotation center
    this.rotationCenter = bounds.center;

    // Bring selection group to front
    this.selectionGroup!.bringToFront();
  }

  /**
   * Hide selection box
   */
  private hideSelectionBox(): void {
    if (this.selectionGroup) {
      this.selectionGroup.removeChildren();
    }
    this.boundingBox = null;
    this.rotationHandle = null;
    this.cornerHandles = [];
    this.edgeHandles = [];
    this.rotationCenter = null;
  }

  /**
   * Handle mouse down event
   * Returns the handle type that was clicked, or null if nothing was clicked
   * ✅ Only handles rotation and scale handles - NOT drag!
   */
  public onMouseDown(event: paper.ToolEvent): 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | null {
    // Check if clicked on rotation handle
    if (this.rotationHandle && this.rotationHandle.contains(event.point)) {
      this.isRotating = true;
      this.dragStartPoint = event.point;
      this.initialRotation = this.calculateAngle(event.point);
      return 'rotation';
    }

    // Check corner handles
    for (const handle of this.cornerHandles) {
      if (handle.contains(event.point)) {
        this.isScaling = true;
        this.activeHandle = handle;
        this.dragStartPoint = event.point;
        return 'scale-corner';
      }
    }

    // Check edge handles
    for (const handle of this.edgeHandles) {
      if (handle.contains(event.point)) {
        const edgeIndex = handle.data.edgeIndex;
        this.isScaling = true;
        this.activeHandle = handle;
        this.dragStartPoint = event.point;

        // Edge indices: 0=top, 1=right, 2=bottom, 3=left
        if (edgeIndex === 0 || edgeIndex === 2) {
          return 'scale-edge-v'; // Vertical
        } else {
          return 'scale-edge-h'; // Horizontal
        }
      }
    }

    // ✅ NO drag handling - PointerTool will handle clicking on objects
    return null;
  }

  /**
   * Handle mouse drag event
   * Returns the type of drag operation, or null if not dragging
   * ✅ Only returns rotation or scale - NOT drag!
   */
  public onMouseDrag(_event: paper.ToolEvent): 'rotation' | 'scale' | null {
    if (this.isRotating) {
      return 'rotation';
    }

    if (this.isScaling) {
      return 'scale';
    }


    return null;
  }

  /**
   * Handle mouse up event
   * Returns the type of operation that ended, or null
   * ✅ Only returns rotation or scale types - NOT drag!
   */
  public onMouseUp(_event: paper.ToolEvent): 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | null {
    let operationType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | null = null;

    if (this.isRotating) {
      operationType = 'rotation';
    } else if (this.isScaling && this.activeHandle) {
      const edgeIndex = this.activeHandle.data.edgeIndex;
      if (edgeIndex !== undefined) {
        // Edge handle
        operationType = (edgeIndex === 0 || edgeIndex === 2) ? 'scale-edge-v' : 'scale-edge-h';
      } else {
        // Corner handle
        operationType = 'scale-corner';
      }
    }

    // Reset state
    this.isDragging = false;
    this.isRotating = false;
    this.isScaling = false;
    this.dragStartPoint = null;
    this.activeHandle = null;

    return operationType;
  }

  /**
   * Calculate angle from rotation center to point
   */
  private calculateAngle(point: paper.Point): number {
    if (!this.rotationCenter) return 0;

    const vector = point.subtract(this.rotationCenter);
    return Math.atan2(vector.y, vector.x) * 180 / Math.PI;
  }

  /**
   * Destroy selection box
   */
  public destroy(): void {
    this.clear();
    if (this.selectionGroup) {
      this.selectionGroup.remove();
      this.selectionGroup = null;
    }
  }
}

