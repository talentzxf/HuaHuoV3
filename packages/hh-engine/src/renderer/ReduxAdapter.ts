import { Store, Unsubscribe } from "@reduxjs/toolkit";
import { IRenderer } from "./IRenderer";
import { instanceRegistry } from "../core/InstanceRegistry";

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
        const previousLayerIds = previousLayers.allIds || [];
        const currentLayerIds = currentLayers.allIds || [];

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

        // Check for layer property changes (visibility, locked state, etc.)
        currentLayerIds.forEach((layerId: string) => {
            if (previousLayerIds.includes(layerId)) {
                const prevLayer = previousLayers.byId[layerId];
                const currLayer = currentLayers.byId[layerId];

                if (prevLayer && currLayer) {
                    if (prevLayer.visible !== currLayer.visible) {
                        console.debug(`Layer visibility changed: ${layerId} -> ${currLayer.visible}`);
                    }
                    if (prevLayer.locked !== currLayer.locked) {
                        console.debug(`Layer locked state changed: ${layerId} -> ${currLayer.locked}`);
                    }
                }
            }
        });
    }

    private handleGameObjectChanges(previousGameObjects: any, currentGameObjects: any): void {
        const previousGameObjectIds = previousGameObjects.allIds || [];
        const currentGameObjectIds = currentGameObjects.allIds || [];

        // Check for new GameObjects
        const newGameObjectIds = currentGameObjectIds.filter((id: string) => !previousGameObjectIds.includes(id));
        newGameObjectIds.forEach((gameObjectId: string) => {
            console.debug(`GameObject added: ${gameObjectId}`);
        });

        // Check for removed GameObjects
        const removedGameObjectIds = previousGameObjectIds.filter((id: string) => !currentGameObjectIds.includes(id));
        removedGameObjectIds.forEach((gameObjectId: string) => {
            console.debug(`GameObject removed: ${gameObjectId}`);
        });

        // Check for GameObject property changes
        currentGameObjectIds.forEach((gameObjectId: string) => {
            if (previousGameObjectIds.includes(gameObjectId)) {
                const prevGameObject = previousGameObjects.byId[gameObjectId];
                const currGameObject = currentGameObjects.byId[gameObjectId];

                if (prevGameObject && currGameObject) {
                    if (prevGameObject.name !== currGameObject.name) {
                        console.debug(`GameObject name changed: ${gameObjectId} -> ${currGameObject.name}`);
                    }
                    if (prevGameObject.active !== currGameObject.active) {
                        console.debug(`GameObject active state changed: ${gameObjectId} -> ${currGameObject.active}`);
                    }
                }
            }
        });
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
                console.debug(`[ReduxAdapter] Component added: ${componentId} (${currComponent.type})`);
                return;
            }

            // Check if props changed
            const prevPropsStr = JSON.stringify(prevComponent.props);
            const currPropsStr = JSON.stringify(currComponent.props);
            if (prevPropsStr !== currPropsStr) {
                console.debug(`[ReduxAdapter] Component props changed: ${componentId} (${currComponent.type})`);
                console.debug(`[ReduxAdapter] Previous props:`, prevPropsStr);
                console.debug(`[ReduxAdapter] Current props:`, currPropsStr);
                this.handleComponentPropsChange(currComponent);
            }
        });

        // Check for removed components
        Object.keys(prevById).forEach((componentId: string) => {
            if (!currById[componentId]) {
                console.debug(`[ReduxAdapter] Component removed: ${componentId}`);
            }
        });
    }

    /**
     * Handle component props change and update rendering
     */
    private handleComponentPropsChange(component: any): void {
        const { id: componentId, parentId, type } = component;

        console.debug('[ReduxAdapter] handleComponentPropsChange:', componentId, type, 'props:', JSON.stringify(component.props));

        // Get the component instance from registry
        const componentInstance = instanceRegistry.get(componentId);
        if (!componentInstance) {
            console.warn('[ReduxAdapter] Component instance not found in registry:', componentId);
            return; // Component instance not found (might not be registered yet)
        }

        console.debug('[ReduxAdapter] Found component instance:', componentInstance);

        // Get render item from renderer's registry
        const renderItem = (this.renderer as any).getRenderItem?.(parentId);
        if (!renderItem) {
            console.warn('[ReduxAdapter] Render item not found for GameObject:', parentId);
            return; // GameObject doesn't have a render item yet
        }

        console.debug('[ReduxAdapter] Found render item, calling applyToRenderer...');

        // Let the component handle its own rendering update
        // Each component knows how to apply its data to the renderer
        componentInstance.applyToRenderer(this.renderer, renderItem);
        
        console.debug('[ReduxAdapter] applyToRenderer completed');
    }


    getRenderer(): IRenderer {
        return this.renderer;
    }
}



