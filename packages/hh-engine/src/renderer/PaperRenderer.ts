import paper from "paper";
import { IRenderer } from "./IRenderer";
import { RenderItemFactory } from "./RenderItemFactory";

/**
 * Paper.js renderer implementation
 */
export class PaperRenderer implements IRenderer {
    private scope: paper.PaperScope | null = null;

    /**
     * GameObject ID to Paper.js Item mapping
     * This is where Paper.js items should be managed
     */
    private renderItemRegistry = new Map<string, paper.Item>();

    initialize(canvas: HTMLCanvasElement): void {
        this.scope = new paper.PaperScope();
        this.scope.setup(canvas);
    }

    createSceneContext(): paper.PaperScope {
        if (!this.scope) {
            throw new Error("Renderer not initialized. Call initialize() first.");
        }
        return this.scope;
    }

    createLayerContext(sceneContext: paper.PaperScope): paper.Layer {
        return new sceneContext.Layer();
    }

    setLayerVisible(layerContext: paper.Layer, visible: boolean): void {
        layerContext.visible = visible;
    }

    setLayerLocked(layerContext: paper.Layer, locked: boolean): void {
        layerContext.locked = locked;
    }

    createRenderItem(layerContext: paper.Layer, type: string, config: any): paper.Item {
        const scope = this.scope!;

        // Use factory pattern instead of switch-case
        const item = RenderItemFactory.create(type, scope, config);

        // Apply styles
        this.applyStyles(item, config, scope);

        // Add to layer
        item.addTo(layerContext);

        return item;
    }

    private applyStyles(item: paper.Item, config: any, scope: paper.PaperScope): void {
        if (config.fillColor) {
            item.fillColor = new scope.Color(config.fillColor);
        }
        if (config.strokeColor) {
            item.strokeColor = new scope.Color(config.strokeColor);
        }
        if (config.strokeWidth !== undefined) {
            item.strokeWidth = config.strokeWidth;
        }
    }

    updateItemTransform(
        item: paper.Item,
        transform: {
            position: { x: number; y: number };
            rotation: number;
            scale: { x: number; y: number };
        }
    ): void {
        const scope = this.scope!;
        item.position = new scope.Point(transform.position.x, transform.position.y);
        item.rotation = transform.rotation;
        item.scaling = new scope.Point(transform.scale.x, transform.scale.y);
    }

    removeRenderItem(item: paper.Item): void {
        item.remove();
    }

    updateItemVisual(
        item: paper.Item,
        visual: {
            fillColor?: string;
            strokeColor?: string;
            strokeWidth?: number;
            opacity?: number;
        }
    ): void {
        const scope = this.scope!;

        if (visual.fillColor !== undefined) {
            item.fillColor = visual.fillColor ? new scope.Color(visual.fillColor) : null;
        }
        if (visual.strokeColor !== undefined) {
            item.strokeColor = visual.strokeColor ? new scope.Color(visual.strokeColor) : null;
        }
        if (visual.strokeWidth !== undefined) {
            item.strokeWidth = visual.strokeWidth;
        }
        if (visual.opacity !== undefined) {
            item.opacity = visual.opacity;
        }
    }

    removeLayer(layerContext: paper.Layer): void {
        layerContext.remove();
    }

    /**
     * Register a render item for a GameObject
     */
    registerRenderItem(gameObjectId: string, item: paper.Item): void {
        this.renderItemRegistry.set(gameObjectId, item);
    }

    /**
     * Unregister a render item for a GameObject
     */
    unregisterRenderItem(gameObjectId: string): void {
        this.renderItemRegistry.delete(gameObjectId);
    }

    /**
     * Get the render item for a GameObject
     */
    getRenderItem(gameObjectId: string): paper.Item | undefined {
        return this.renderItemRegistry.get(gameObjectId);
    }

    getView(sceneContext: paper.PaperScope): paper.View {
        return sceneContext.view;
    }

    render(): void {
        if (this.scope) {
            this.scope.view.update();
        }
    }

    dispose(): void {
        if (this.scope) {
            this.scope.project.clear();
            this.scope = null;
        }
    }

    getScope(): paper.PaperScope | null {
        return this.scope;
    }
}

