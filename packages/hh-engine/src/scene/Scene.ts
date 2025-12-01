import { getEngineStore, getEngineState } from "../core/EngineGlobals";
import { Layer } from "./Layer";
import {IScene} from "../core/IScene";
import { ILayer } from "../core/ILayer";
import {addLayerToScene, createScene, setCurrentScene} from "../store/SceneSlice";
import {createLayer} from "../store/LayerSlice";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";

export class Scene extends RegistrableEntity implements IScene {
    private renderer: IRenderer;
    private sceneContext: any;
    private layerContextCache = new Map<string, any>();

    getLayerContextById(layerId: string): any {
        if (!this.layerContextCache.has(layerId)) {
            const layerContext = this.renderer.createLayerContext(this.sceneContext);
            this.layerContextCache.set(layerId, layerContext);
            return layerContext;
        }
        return this.layerContextCache.get(layerId)!;
    }

    constructor(sceneId: string, renderer: IRenderer, sceneContext: any) {
        // Call RegistrableEntity constructor - auto-registers
        super(sceneId);

        this.renderer = renderer;
        this.sceneContext = sceneContext;
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

        return new Layer(layerId, this.renderer, this.getLayerContextById(layerId));
    }

    destroy(): void {
        throw new Error("Method not implemented.");
    }

    static create(name: string, renderer: IRenderer, sceneContext: any): Scene {
        const store = getEngineStore();
        const sceneId = store.dispatch(createScene(name)).payload.id;
        store.dispatch(setCurrentScene(sceneId));
        return new Scene(sceneId, renderer, sceneContext);
    }

    get name(): string {
        return getEngineState().scenes.byId[this.id].name;
    }

    get layers(): Layer[] {
        const engineState = getEngineState();
        const scene = engineState.scenes.byId[this.id];

        return scene.layerIds.map(
            (layerId: string) => new Layer(layerId, this.renderer, this.getLayerContextById(layerId))
        );
    }

    addLayer(name: string): Layer {
        const store = getEngineStore();
        const layerId = store.dispatch(createLayer(name)).payload.id;
        store.dispatch(
            addLayerToScene({ sceneId: this.id, layerId })
        );

        const layerContext = this.renderer.createLayerContext(this.sceneContext);
        this.layerContextCache.set(layerId, layerContext);
        return new Layer(layerId, this.renderer, layerContext);
    }

    removeLayer(layer: Layer): void {
        // TODO: Implement layer removal
        layer.destroy();
        this.layerContextCache.delete(layer.id);
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

