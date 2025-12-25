import { Store, Unsubscribe } from "@reduxjs/toolkit";
import { IRenderer } from "./IRenderer";
import {InstanceRegistry} from "../core/InstanceRegistry";

/**
 * Redux to Renderer Adapter
 * Listens to Redux store changes and updates rendering automatically
 * This is an adapter that bridges Redux state management and the rendering system
 */
export class ReduxAdapter {
    private renderer: IRenderer;
    private store: Store;
    private unsubscribe: Unsubscribe | null = null;
    private previousState: any = null;

    constructor(renderer: IRenderer, store: Store) {
        this.renderer = renderer;
        this.store = store;
    }

    /**
     * Start listening to Redux store changes
     */
    startListening(): void {
        console.debug('[ReduxAdapter] startListening called');

        if (this.unsubscribe) {
            console.warn("[ReduxAdapter] Already listening to store changes");
            return;
        }

        this.previousState = this.store.getState();
        console.debug('[ReduxAdapter] Initial state:', this.previousState);

        this.unsubscribe = this.store.subscribe(() => {
            console.debug('[ReduxAdapter] Store subscription triggered');
            const currentState = this.store.getState();

            // Extract engine state (assuming it's nested under 'engine' key)
            const prevEngineState = this.previousState.engine || this.previousState;
            const currEngineState = currentState.engine || currentState;

            this.handleStateChange(prevEngineState, currEngineState);

            this.previousState = currentState;
        });

        console.debug('[ReduxAdapter] Store subscription established');
    }

    /**
     * Stop listening to Redux store changes
     */
    stopListening(): void {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    /**
     * Handle state changes and update rendering accordingly
     */
    private handleStateChange(previousState: any, currentState: any): void {
        console.debug('[ReduxAdapter] handleStateChange called');
        console.debug('[ReduxAdapter] Previous state keys:', Object.keys(previousState));
        console.debug('[ReduxAdapter] Current state keys:', Object.keys(currentState));
        console.debug('[ReduxAdapter] Components comparison:', {
            prevComponents: previousState.components,
            currComponents: currentState.components,
            areSame: previousState.components === currentState.components
        });

        // Check for scene changes
        if (previousState.scenes !== currentState.scenes) {
            console.debug('[ReduxAdapter] Scenes changed');
            this.handleSceneChanges(previousState.scenes, currentState.scenes);
        }

        // Check for layer changes
        if (previousState.layers !== currentState.layers) {
            console.debug('[ReduxAdapter] Layers changed');
            this.handleLayerChanges(previousState.layers, currentState.layers);
        }

        // Check for GameObject changes
        if (previousState.gameObjects !== currentState.gameObjects) {
            console.debug('[ReduxAdapter] GameObjects changed');
            this.handleGameObjectChanges(previousState.gameObjects, currentState.gameObjects);
        }

        // Check for component changes
        if (previousState.components !== currentState.components) {
            console.debug('[ReduxAdapter] Components changed');
            this.handleComponentChanges(previousState.components, currentState.components);
        } else {
            console.debug('[ReduxAdapter] Components NOT changed (same reference)');
        }

        // Trigger render
        this.renderer.render();
    }

    private handleSceneChanges(previousScenes: any, currentScenes: any): void {
        // Handle current scene change
        if (previousScenes.currentSceneId !== currentScenes.currentSceneId) {
            console.debug(`Scene changed: ${previousScenes.currentSceneId} -> ${currentScenes.currentSceneId}`);
            // Scene switching logic can be implemented here
        }
    }

    private handleLayerChanges(previousLayers: any, currentLayers: any): void {
        const previousLayerIds = Object.keys(previousLayers.byId || {});
        const currentLayerIds = Object.keys(currentLayers.byId || {});

        // Check for new layers
        const newLayerIds = currentLayerIds.filter((id: string) => !previousLayerIds.includes(id));
        newLayerIds.forEach((layerId: string) => {
            console.debug(`Layer added: ${layerId}`);
        });

        // Check for removed layers
        const removedLayerIds = previousLayerIds.filter((id: string) => !currentLayerIds.includes(id));
        removedLayerIds.forEach((layerId: string) => {
            console.debug(`Layer removed: ${layerId}`);
        });

        // Check for layer property changes (only if needed for rendering)
        currentLayerIds.forEach((layerId: string) => {
            if (previousLayerIds.includes(layerId)) {
                const prevLayer = previousLayers.byId[layerId];
                const currLayer = currentLayers.byId[layerId];

                if (prevLayer && currLayer) {
                    // Only handle name change as it affects Paper.js layer
                    if (prevLayer.name !== currLayer.name) {
                        this.handleLayerNameChange(layerId, currLayer.name);
                    }
                    // Skip visibility/locked checks - they don't affect Paper.js rendering
                }
            }
        });
    }

    /**
     * Handle layer name change and update Paper.js layer name
     */
    private handleLayerNameChange(layerId: string, newName: string): void {
        // Get the Layer instance from registry
        const layerInstance = InstanceRegistry.getInstance().get(layerId);
        if (!layerInstance) {
            console.warn(`[ReduxAdapter] Layer instance not found: ${layerId}`);
            return;
        }

        // Get the Paper.js layer context
        const layerContext = (layerInstance as any).getLayerContext?.();
        if (!layerContext) {
            console.warn(`[ReduxAdapter] Layer context not found for layer: ${layerId}`);
            return;
        }

        // Update the Paper.js layer name
        layerContext.name = newName;
        console.debug(`[ReduxAdapter] Updated Paper.js layer name: ${layerId} -> ${newName}`);
    }

    private handleGameObjectChanges(previousGameObjects: any, currentGameObjects: any): void {
        const previousGameObjectIds = Object.keys(previousGameObjects.byId || {});
        const currentGameObjectIds = Object.keys(currentGameObjects.byId || {});

        // Check for new GameObjects
        const newGameObjectIds = currentGameObjectIds.filter((id: string) => !previousGameObjectIds.includes(id));
        newGameObjectIds.forEach((gameObjectId: string) => {
            console.debug(`GameObject added: ${gameObjectId}`);
        });

        // Check for removed GameObjects
        const removedGameObjectIds = previousGameObjectIds.filter((id: string) => !currentGameObjectIds.includes(id));
        removedGameObjectIds.forEach((gameObjectId: string) => {
            console.debug(`GameObject removed: ${gameObjectId}`);
            // ✅ Remove the Paper.js render item
            this.handleGameObjectRemoved(gameObjectId);
        });

        // Check for GameObject property changes (only active state affects rendering)
        currentGameObjectIds.forEach((gameObjectId: string) => {
            if (previousGameObjectIds.includes(gameObjectId)) {
                const prevGameObject = previousGameObjects.byId[gameObjectId];
                const currGameObject = currentGameObjects.byId[gameObjectId];

                if (prevGameObject && currGameObject) {
                    // Only check active state as it affects visibility
                    if (prevGameObject.active !== currGameObject.active) {
                        this.handleGameObjectActiveChange(gameObjectId, currGameObject.active);
                    }
                    // Skip name check - it doesn't affect rendering
                }
            }
        });
    }

    /**
     * Handle GameObject active state change and update render item visibility
     */
    private handleGameObjectActiveChange(gameObjectId: string, active: boolean): void {
        const renderItem = (this.renderer as any).getRenderItem?.(gameObjectId);
        if (!renderItem) return;

        // Clear selection first if becoming inactive
        if (!active && renderItem.selected) {
            renderItem.selected = false;
        }

        // Update visibility of the render item
        if (renderItem.visible !== undefined) {
            renderItem.visible = active;
        }
    }

    /**
     * Handle GameObject removal - remove Paper.js render item
     */
    private handleGameObjectRemoved(gameObjectId: string): void {
        const renderItem = (this.renderer as any).getRenderItem?.(gameObjectId);
        if (!renderItem) {
            console.debug(`[ReduxAdapter] No render item found for GameObject: ${gameObjectId}`);
            return;
        }

        console.debug(`[ReduxAdapter] Removing render item for GameObject: ${gameObjectId}`);

        // Remove the Paper.js item from canvas
        if (renderItem.remove) {
            renderItem.remove();
        }

        // Unregister from renderer's registry
        if ((this.renderer as any).unregisterRenderItem) {
            (this.renderer as any).unregisterRenderItem(gameObjectId);
        }
    }

    private handleComponentChanges(previousComponents: any, currentComponents: any): void {
        const prevById = previousComponents.byId || {};
        const currById = currentComponents.byId || {};

        // Check all current components for changes
        Object.keys(currById).forEach((componentId: string) => {
            const prevComponent = prevById[componentId];
            const currComponent = currById[componentId];

            if (!prevComponent) {
                // New component added
                return;
            }

            // If props reference changed, update rendering
            // Redux Toolkit's Immer will create new object reference when props change
            if (prevComponent.props !== currComponent.props) {
                this.handleComponentPropsChange(currComponent);
            }
        });
    }

    /**
     * Handle component props change and update rendering
     */
    private handleComponentPropsChange(component: any): void {
        const { id: componentId, parentId } = component;

        // Get the component instance from registry
        const componentInstance = InstanceRegistry.getInstance().get(componentId);
        if (!componentInstance) {
            return; // Component instance not found (might not be registered yet)
        }

        // Get render item from renderer's registry
        const renderItem = (this.renderer as any).getRenderItem?.(parentId);
        if (!renderItem) {
            return; // GameObject doesn't have a render item yet
        }

        // Let the component handle its own rendering update
        componentInstance.applyToRenderer(this.renderer, renderItem);
    }


    getRenderer(): IRenderer {
        return this.renderer;
    }
}



