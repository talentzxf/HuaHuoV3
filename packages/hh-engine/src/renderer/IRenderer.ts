/**
 * Abstract renderer interface
 * Defines all methods that a rendering engine needs to implement
 */
export interface IRenderer {
    /**
     * Initialize the renderer
     */
    initialize(canvas: HTMLCanvasElement): void;

    /**
     * Create a scene context
     */
    createSceneContext(): any;

    /**
     * Create a layer context
     * @param sceneContext - The scene context
     * @param name - Optional name for the layer
     */
    createLayerContext(sceneContext: any, name?: string): any;

    /**
     * Set layer visibility
     */
    setLayerVisible(layerContext: any, visible: boolean): void;

    /**
     * Set layer locked state
     */
    setLayerLocked(layerContext: any, locked: boolean): void;

    /**
     * Create a render item (for GameObject)
     * @param layerContext The layer context to add the item to
     * @param type The type of render item to create
     * @param config Configuration for the render item
     */
    createRenderItem(layerContext: any, type: string, config: any): any;

    /**
     * Update render item transform
     */
    updateItemTransform(item: any, transform: {
        position: { x: number; y: number };
        rotation: number;
        scale: { x: number; y: number };
    }): void;

    /**
     * Remove a render item
     */
    removeRenderItem(item: any): void;

    /**
     * Update render item visual properties (colors, stroke, etc.)
     */
    updateItemVisual(item: any, visual: {
        fillColor?: string;
        strokeColor?: string;
        strokeWidth?: number;
        opacity?: number;
    }): void;

    /**
     * Remove a layer
     */
    removeLayer(layerContext: any): void;

    /**
     * Get the view object (for tools, etc.)
     */
    getView(sceneContext: any): any;

    /**
     * Render a frame
     */
    render(): void;

    /**
     * Clean up resources
     */
    dispose(): void;
}

