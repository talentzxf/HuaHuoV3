import { getEngineStore, getEngineState } from "../core/EngineGlobals";
import { Layer } from "./Layer";
import {IScene} from "../core/IScene";
import { ILayer } from "../core/ILayer";
import {addLayerToScene, createScene, setCurrentScene} from "../store/SceneSlice";
import {createLayer} from "../store/LayerSlice";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";
import {InstanceRegistry} from "../core/InstanceRegistry";

export class Scene extends RegistrableEntity implements IScene {
    private renderer: IRenderer;
    private sceneContext: any;

    constructor(sceneId: string, renderer: IRenderer, sceneContext: any) {
        // Call RegistrableEntity constructor - auto-registers
        super(sceneId);

        this.renderer = renderer;
        this.sceneContext = sceneContext;
    }

    get duration(): number {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];
        return scene?.duration || 5.0; // Default 5 seconds
    }

    set duration(value: number) {
        const store = getEngineStore();
        store.dispatch({
            type: 'scenes/setDuration',
            payload: { sceneId: this.id, duration: value }
        });
    }

    get fps(): number {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];
        return scene?.fps || 30; // Default 30 fps
    }

    set fps(value: number) {
        const store = getEngineStore();
        store.dispatch({
            type: 'scenes/setFps',
            payload: { sceneId: this.id, fps: value }
        });
    }

    getLayerByName(name: string): ILayer | undefined {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];
        if (!scene) return undefined;

        const layerId = scene.layerIds.find((id: string) => {
            const layer = engineState.layers.byId[id];
            return layer && layer.name === name;
        });

        if (!layerId) return undefined;

        // Only return existing instance, don't create
        return InstanceRegistry.getInstance().get<Layer>(layerId);
    }

    destroy(): void {
        throw new Error("Method not implemented.");
    }

    static create(name: string, renderer: IRenderer, sceneContext: any): Scene {
        const store = getEngineStore();
        const sceneId = store.dispatch(createScene(name)).payload.id;
        store.dispatch(setCurrentScene(sceneId));

        console.debug('[Scene.create] Creating Scene:', sceneId);
        return InstanceRegistry.getInstance().getOrCreate<Scene>(sceneId, () => {
            console.debug('[Scene.create] Factory: new Scene:', sceneId);
            return new Scene(sceneId, renderer, sceneContext);
        });
    }

    get name(): string {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];
        return scene?.name || 'Untitled Scene';
    }

    set name(value: string) {
        const store = getEngineStore();
        store.dispatch({
            type: 'scenes/setSceneName',
            payload: { sceneId: this.id, name: value }
        });
    }

    get layers(): Layer[] {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];

        // Only return existing instances from InstanceRegistry
        // DO NOT create new instances here - creation only happens in addLayer
        return scene.layerIds
            .map((layerId: string) => InstanceRegistry.getInstance().get<Layer>(layerId))
            .filter((layer): layer is Layer => layer !== undefined);
    }

    addLayer(name: string): Layer {
        const store = getEngineStore();
        const layerId = store.dispatch(createLayer(name)).payload.id;
        store.dispatch(
            addLayerToScene({ sceneId: this.id, layerId })
        );

        const layerContext = this.renderer.createLayerContext(this.sceneContext);

        return InstanceRegistry.getInstance().getOrCreate<Layer>(layerId, () => {
            return new Layer(layerId, this.renderer, layerContext);
        });
    }

    removeLayer(layer: Layer): void {
        // TODO: Implement layer removal from Redux store
        layer.destroy();
        // Layer will be unregistered in its destroy() method
    }

    update(deltaTime: number): void {
        // Update all layers and their game objects
        this.layers.forEach(layer => {
            layer.gameObjects.forEach(gameObject => {
                gameObject.update(deltaTime);
            });
        });
    }
}



