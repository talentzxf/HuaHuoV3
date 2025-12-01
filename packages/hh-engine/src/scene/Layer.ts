import { ILayer } from "../core/ILayer";
import { IGameObject } from "../core/IGameObject";
import { GameObject } from "./GameObject";

import { getEngineStore, getEngineState } from "../core/EngineGlobals";
import {
    setLayerVisible,
    setLayerLocked,
    addGameObjectToLayer,
    removeGameObjectFromLayer,
} from "../store/LayerSlice";
import {
    createGameObject,
    deleteGameObject,
} from "../store/GameObjectSlice";
import { IRenderer } from "../renderer";
import { RegistrableEntity } from "../core/RegistrableEntity";

export class Layer extends RegistrableEntity implements ILayer {
    private renderer: IRenderer;
    private layerContext: any;

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

    get name(): string {
        return getEngineState().layers.byId[this.id].name;
    }

    get gameObjects(): ReadonlyArray<IGameObject> {
        const engineState = getEngineState();
        const layer = engineState.layers.byId[this.id];
        if (!layer) return [];

        // Get render items from renderer's registry
        return layer.gameObjectIds.map((goId: string) => {
            const renderItem = (this.renderer as any).getRenderItem?.(goId);
            return new GameObject(goId, this.renderer, this.layerContext, renderItem);
        });
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

    addGameObject(name: string, renderItem?: any): IGameObject {
        const store = getEngineStore();
        const action = createGameObject(name, this.id);
        const { id: gameObjectId } = store.dispatch(action).payload;

        store.dispatch(
            addGameObjectToLayer({ layerId: this.id, gameObjectId })
        );

        // Create GameObject - it will register the render item in Engine's registry
        return new GameObject(
            gameObjectId,
            this.renderer,
            this.layerContext,
            renderItem
        );
    }

    findGameObject(name: string): IGameObject | undefined {
        return this.gameObjects.find(go => go.name === name);
    }

    removeGameObject(gameObject: IGameObject): void {
        const store = getEngineStore();
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
                const renderItem = (this.renderer as any).getRenderItem?.(goId);
                const go = new GameObject(goId, this.renderer, this.layerContext, renderItem);
                go.destroy();
            });
        }
    }

    update(deltaTime: number): void {
        this.gameObjects.forEach((gameObject) => {
            gameObject.update(deltaTime);
        });
    }
}

