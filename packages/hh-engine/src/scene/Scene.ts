import paper from "paper";
import { store } from "../store/store";
import { Layer } from "./Layer";
import {IScene} from "../core/IScene";
import { ILayer } from "../core/ILayer";
import {addLayerToScene, createScene, setCurrentScene} from "../store/SceneSlice";
import {createLayer} from "../store/LayerSlice";

export class Scene implements IScene {
    readonly id: string;
    private scope: paper.PaperScope;
    private layerCache = new Map<string, paper.Layer>();

    getPaperLayerById(layerId: string): paper.Layer {
        if (!this.layerCache.has(layerId)) {
            const paperLayer = new this.scope.Layer();
            this.layerCache.set(layerId, paperLayer);
            return paperLayer;
        }
        return this.layerCache.get(layerId)!;
    }

    constructor(sceneId: string, scope: paper.PaperScope) {
        this.id = sceneId;
        this.scope = scope;
    }

    getLayerByName(name: string): ILayer | undefined {
        throw new Error("Method not implemented.");
    }
    destroy(): void {
        throw new Error("Method not implemented.");
    }

    static create(name: string, scope: paper.PaperScope): Scene {
        const sceneId = store.dispatch(createScene(name)).payload.id;
        store.dispatch(setCurrentScene(sceneId));
        return new Scene(sceneId, scope);
    }

    get name(): string {
        return store.getState().scenes.byId[this.id].name;
    }

    get layers(): Layer[] {
        const state = store.getState();
        const scene = state.scenes.byId[this.id];

        return scene.layerIds.map(
            (layerId) => new Layer(layerId, this.scope, this.getPaperLayerById(layerId))
        );
    }

    addLayer(name: string): Layer {
        const layerId = store.dispatch(createLayer(name)).payload.id;
        store.dispatch(
            addLayerToScene({ sceneId: this.id, layerId })
        );

        const paperLayer = new this.scope.Layer();
        return new Layer(layerId, this.scope, paperLayer);
    }

    removeLayer(layer: Layer) {
        throw new Error("Method not implemented.");
    }

    update(deltaTime: number) {
        throw new Error("Method not implemented.");
    }
}