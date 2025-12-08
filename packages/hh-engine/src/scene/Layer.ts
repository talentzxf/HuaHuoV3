import { ILayer } from "../core/ILayer";
import { IGameObject } from "../core/IGameObject";
import { GameObject } from "./GameObject";

import { getEngineStore, getEngineState } from "../core/EngineGlobals";
import {
    setLayerVisible,
    setLayerLocked,
    setLayerHasTimeline,
    addGameObjectToLayer,
    removeGameObjectFromLayer,
    addKeyFrame,
} from "../store/LayerSlice";
import {
    createGameObject,
    deleteGameObject,
} from "../store/GameObjectSlice";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";
import {InstanceRegistry} from "../core/InstanceRegistry";

export class Layer extends RegistrableEntity implements ILayer {
    private renderer: IRenderer;
    private layerContext: any;
    // Track name counters to generate unique names
    private nameCounters: Map<string, number> = new Map();

    constructor(
        layerId: string,
        renderer: IRenderer,
        layerContext: any
    ) {
        // Call RegistrableEntity constructor - auto-registers
        super(layerId);

        this.renderer = renderer;
        this.layerContext = layerContext;
    }

    /**
     * Generate a unique name for GameObject
     * If name already exists, append a number (e.g., Circle-1, Circle-2)
     */
    private generateUniqueName(baseName: string): string {
        // Extract base name without number suffix
        const match = baseName.match(/^(.+?)-(\d+)$/);
        const base = match ? match[1] : baseName;

        // Get current counter for this base name
        const counter = this.nameCounters.get(base) || 0;
        const newCounter = counter + 1;
        this.nameCounters.set(base, newCounter);

        // Generate name with counter
        const newName = `${base}-${newCounter}`;

        // Check if this name already exists in current gameObjects
        const exists = this.gameObjects.some(go => go.name === newName);
        if (exists) {
            // If it exists, increment and try again
            return this.generateUniqueName(baseName);
        }

        return newName;
    }

    /**
     * Centralized GameObject factory method
     * This ensures all GameObjects are created consistently with proper render item registration
     */
    private createGameObjectInstance(gameObjectId: string, renderItem?: any): GameObject {
        console.log('[Layer] createGameObjectInstance:', gameObjectId, 'renderItem:', !!renderItem);
        const gameObject = new GameObject(gameObjectId, this.renderer, this.layerContext, renderItem);
        console.log('[Layer] GameObject created:', gameObjectId);
        return gameObject;
    }

    get name(): string {
        return getEngineState().layers.byId[this.id].name;
    }

    get gameObjects(): ReadonlyArray<IGameObject> {
        const engineState = getEngineState();
        const layer = engineState.layers.byId[this.id];
        if (!layer) return [];

        // Only return existing instances from InstanceRegistry
        // DO NOT create new instances here - creation only happens in addGameObject
        return layer.gameObjectIds
            .map((goId: string) => InstanceRegistry.getInstance().get<GameObject>(goId))
            .filter((go): go is GameObject => go !== undefined);
    }

    get visible(): boolean {
        return getEngineState().layers.byId[this.id].visible;
    }

    set visible(v: boolean) {
        getEngineStore().dispatch(setLayerVisible({ layerId: this.id, visible: v }));
        this.renderer.setLayerVisible(this.layerContext, v);
    }

    get locked(): boolean {
        return getEngineState().layers.byId[this.id].locked;
    }

    set locked(v: boolean) {
        getEngineStore().dispatch(setLayerLocked({ layerId: this.id, locked: v }));
        this.renderer.setLayerLocked(this.layerContext, v);
    }

    get hasTimeline(): boolean {
        return getEngineState().layers.byId[this.id].hasTimeline;
    }

    set hasTimeline(v: boolean) {
        getEngineStore().dispatch(setLayerHasTimeline({ layerId: this.id, hasTimeline: v }));
    }

    addGameObject(name: string, renderItem?: any): IGameObject {
        // Generate unique name to avoid duplicates
        const uniqueName = this.generateUniqueName(name);

        const store = getEngineStore();

        // Get current frame to set as bornFrameId
        const currentFrame = getEngineState().playback.currentFrame;

        // Create GameObject with current frame as bornFrameId
        const action = createGameObject(uniqueName, this.id, currentFrame);
        const { id: gameObjectId } = store.dispatch(action).payload;

        store.dispatch(
            addGameObjectToLayer({ layerId: this.id, gameObjectId })
        );

        // Add keyframe marker at current frame when GameObject is added
        store.dispatch(addKeyFrame({ layerId: this.id, frame: currentFrame, gameObjectId }));

        console.debug('[Layer.addGameObject] Creating GameObject:', gameObjectId, 'name:', uniqueName, 'at frame:', currentFrame, 'with renderItem:', !!renderItem);

        // Create the GameObject instance (this will also create its components)
        const gameObject = InstanceRegistry.getInstance().getOrCreate<GameObject>(gameObjectId, () => {
            return this.createGameObjectInstance(gameObjectId, renderItem);
        });

        // Record initial keyframes for all component properties at birth frame
        this.recordInitialKeyframes(gameObjectId, currentFrame);

        return gameObject;
    }

    /**
     * Record keyframes for all properties of all components at the birth frame
     * This ensures the animation system has correct initial values
     */
    private recordInitialKeyframes(gameObjectId: string, frame: number): void {
        const { setPropertyKeyFrame } = require('../store/ComponentSlice');
        const state = getEngineState();
        const gameObject = state.gameObjects.byId[gameObjectId];

        if (!gameObject || !gameObject.componentIds) {
            return;
        }

        const store = getEngineStore();

        // Iterate through all components of this GameObject
        for (const componentId of gameObject.componentIds) {
            const component = state.components.byId[componentId];
            if (!component) continue;

            // Record keyframe for each property
            for (const propName in component.props) {
                const propValue = component.props[propName];

                store.dispatch(setPropertyKeyFrame({
                    componentId: componentId,
                    propName: propName,
                    frame: frame,
                    value: propValue
                }));

                console.debug(`[Layer] Recorded initial keyframe: Component ${component.type}.${propName} =`, propValue, 'at frame', frame);
            }
        }
    }

    findGameObject(name: string): IGameObject | undefined {
        return this.gameObjects.find(go => go.name === name);
    }

    removeGameObject(gameObject: IGameObject): void {
        const store = getEngineStore();

        // removeGameObjectFromLayer now auto-cleans keyframes
        store.dispatch(
            removeGameObjectFromLayer({
                layerId: this.id,
                gameObjectId: gameObject.id,
            })
        );
        store.dispatch(deleteGameObject(gameObject.id));
        gameObject.destroy();
    }

    destroy(): void {
        const layerState = getEngineState().layers.byId[this.id];
        if (layerState) {
            layerState.gameObjectIds.forEach((goId: string) => {
                const go = InstanceRegistry.getInstance().get<GameObject>(goId);
                if (go) {
                    go.destroy();
                }
            });
        }

        // Unregister this layer
        InstanceRegistry.getInstance().unregister(this.id);
    }

    update(deltaTime: number): void {
        this.gameObjects.forEach((gameObject) => {
            gameObject.update(deltaTime);
        });
    }

    /**
     * Get the Paper.js layer context
     * Used by Engine for operations like resize
     */
    getLayerContext(): any {
        return this.layerContext;
    }
}



