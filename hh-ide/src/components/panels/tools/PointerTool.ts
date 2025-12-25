import paper from 'paper';
import {BaseTool} from './BaseTool';
import {store} from '../../../store/store';
import {selectObject, clearSelection} from '../../../store/features/selection/selectionSlice';
import {RotatableSelectionBox} from './RotatableSelectionBox';
import {
    shapeTranslateHandler,
    shapeRotateHandler,
    shapeScaleHandler,
    shapeHorizontalScaleHandler,
    shapeVerticalScaleHandler
} from './handlers';

export class PointerTool extends BaseTool {
    name = 'pointer';
    private selectionRect: paper.Path.Rectangle | null = null;
    private rotatableSelection: RotatableSelectionBox;
    private currentOperationType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag' | null = null;

    constructor(color: string) {
        super(color);
        // ✅ 直接创建 RotatableSelectionBox，不需要延迟创建
        this.rotatableSelection = new RotatableSelectionBox();
    }

    onMouseDown(event: paper.ToolEvent, scope: paper.PaperScope): void {
        this.startPoint = event.point.clone();

        const activeLayer = scope.project.activeLayer;
        if (!activeLayer) {
            return;
        }

        // ✅ FIRST: Check if clicked on selection box handles (rotation/scale ONLY)
        const handleType = this.rotatableSelection.onMouseDown(event);
        if (handleType) {
            // Clicked on handle - start rotation/scale
            this.currentOperationType = handleType;

            const gameObjectIds = new Set<string>();
            this.rotatableSelection.getSelectedItems().forEach(item => {
                if (item.data?.gameObjectId) {
                    gameObjectIds.add(item.data.gameObjectId);
                }
            });

            this.startHandler(handleType, gameObjectIds, event.point);
            this.startPoint = null;
            return;
        }

        // THEN: Check if clicked on an object
        const hitResult = activeLayer.hitTest(event.point, {
            segments: true,
            stroke: true,
            fill: true,
            tolerance: 5
        });

        if (hitResult && hitResult.item) {
            // Skip selection box UI elements
            if (hitResult.item.data?.isSelectionBox) {
                return;
            }

            // Skip locked items
            if (hitResult.item.locked) {
                return;
            }

            const gameObjectId = hitResult.item.data?.gameObjectId;
            if (!gameObjectId) {
                return;
            }

            // ✅ 简化：击中物体就显示 RotatableSelectionBox 并默认 drag
            // Disable Paper.js default selection
            activeLayer.children.forEach((item: any) => {
                item.selected = false;
            });

            // Dispatch Redux selection
            store.dispatch(selectObject({type: 'gameObject', id: gameObjectId}));

            // ✅ 显示 RotatableSelectionBox
            this.rotatableSelection.setSelection([hitResult.item]);

            // ✅ 默认行为：drag
            this.currentOperationType = 'drag';
            const gameObjectIds = new Set<string>([gameObjectId]);
            this.startHandler('drag', gameObjectIds, event.point);

            // ✅ Keep startPoint for dragging
        }
    }

    onMouseDrag(event: paper.ToolEvent, scope: paper.PaperScope): void {
        // ✅ If we're in a transform operation, handle it directly
        if (this.currentOperationType) {
            this.dragHandler(this.currentOperationType, event.point);
            this.rotatableSelection.refresh();
            return;
        }

        // Otherwise, draw selection rectangle
        if (!this.startPoint) return;

        if (this.selectionRect) {
            this.selectionRect.remove();
        }

        const rect = new scope.Rectangle(this.startPoint, event.point);
        this.selectionRect = new scope.Path.Rectangle(rect);
        this.selectionRect.strokeColor = new scope.Color('#1890ff');
        this.selectionRect.strokeWidth = 1;
        this.selectionRect.dashArray = [4, 4];
        this.selectionRect.fillColor = new scope.Color(0.11, 0.56, 1, 0.1);
    }

    onMouseUp(event: paper.ToolEvent, scope: paper.PaperScope): void {
        // ✅ If we're in a transform operation, end it
        if (this.currentOperationType) {
            this.endHandler(this.currentOperationType);
            this.rotatableSelection.refresh();

            this.currentOperationType = null;
            this.startPoint = null;
            return;
        }

        const activeLayer = scope.project.activeLayer;
        if (!activeLayer) {
            return;
        }

        // Handle selection rectangle (drag selection)
        if (this.selectionRect) {
            const selectionBounds = this.selectionRect.bounds;

            let selectedItem: paper.Item | null = null;
            let selectedGameObjectId: string | null = null;

            activeLayer.children.forEach((item: any) => {
                if (item.locked || item.data?.isSelectionBox) return;

                if (item.bounds.intersects(selectionBounds)) {
                    if (!selectedItem && item.data?.gameObjectId) {
                        selectedItem = item;
                        selectedGameObjectId = item.data.gameObjectId;
                    }
                }
            });

            if (selectedGameObjectId && selectedItem) {
                store.dispatch(selectObject({type: 'gameObject', id: selectedGameObjectId}));
                this.rotatableSelection.setSelection([selectedItem]);
            } else {
                store.dispatch(clearSelection());
                this.rotatableSelection.clear();
            }

            this.selectionRect.remove();
            this.selectionRect = null;
        } else if (this.startPoint) {
            // Single click on empty space
            store.dispatch(clearSelection());
            this.rotatableSelection.clear();
        }

        this.startPoint = null;
        this.currentOperationType = null;
    }

    /**
     * Start appropriate handler based on operation type
     */
    private startHandler(
        opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag',
        gameObjectIds: Set<string>,
        point: paper.Point
    ): void {
        const pos = {x: point.x, y: point.y};

        switch (opType) {
            case 'rotation':
                shapeRotateHandler.setTarget(gameObjectIds);
                shapeRotateHandler.beginMove(pos);
                break;

            case 'scale-corner':
                shapeScaleHandler.setTarget(gameObjectIds);
                shapeScaleHandler.beginMove(pos);
                break;

            case 'scale-edge-h':
                shapeHorizontalScaleHandler.setTarget(gameObjectIds);
                shapeHorizontalScaleHandler.beginMove(pos);
                break;

            case 'scale-edge-v':
                shapeVerticalScaleHandler.setTarget(gameObjectIds);
                shapeVerticalScaleHandler.beginMove(pos);
                break;

            case 'drag':
                // Use the gameObjectIds parameter passed in
                shapeTranslateHandler.setTarget(gameObjectIds);
                shapeTranslateHandler.beginMove(pos);
                break;
        }
    }

    /**
     * Drag appropriate handler
     */
    private dragHandler(
        opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag',
        point: paper.Point
    ): void {
        const pos = {x: point.x, y: point.y};

        switch (opType) {
            case 'rotation':
                shapeRotateHandler.dragging(pos);
                break;

            case 'scale-corner':
                shapeScaleHandler.dragging(pos);
                break;

            case 'scale-edge-h':
                shapeHorizontalScaleHandler.dragging(pos);
                break;

            case 'scale-edge-v':
                shapeVerticalScaleHandler.dragging(pos);
                break;

            case 'drag':
                shapeTranslateHandler.dragging(pos);
                break;
        }
    }

    /**
     * End appropriate handler
     */
    private endHandler(
        opType: 'rotation' | 'scale-corner' | 'scale-edge-v' | 'scale-edge-h' | 'drag'
    ): void {
        switch (opType) {
            case 'rotation':
                shapeRotateHandler.endMove();
                break;

            case 'scale-corner':
                shapeScaleHandler.endMove();
                break;

            case 'scale-edge-h':
                shapeHorizontalScaleHandler.endMove();
                break;

            case 'scale-edge-v':
                shapeVerticalScaleHandler.endMove();
                break;

            case 'drag':
                shapeTranslateHandler.endMove();
                break;
        }
    }
}

