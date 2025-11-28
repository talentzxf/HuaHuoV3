import paper from "paper";
import { ILayer } from "../core/ILayer";
import { IGameObject } from "../core/IGameObject";
import { GameObject } from "./GameObject";

import { store } from "../store/store";
import {
    renameLayer,
    setLayerVisible,
    setLayerLocked,
    addGameObjectToLayer,
    removeGameObjectFromLayer,
} from "../store/LayerSlice";
import {
    createGameObject,
    deleteGameObject,
} from "../store/GameObjectSlice";

export class Layer implements ILayer {
    readonly id: string;

    private scope: paper.PaperScope;
    private paperLayer: paper.Layer;

    private gameObjectPaperItemCache = new Map<string, paper.Item>();

    private getPaperItemById(gameObjectId: string): paper.Item {
        if (!this.gameObjectPaperItemCache.has(gameObjectId)) {
            throw new Error(`GameObject with ID ${gameObjectId} not found in layer ${this.id}`);
        }
        return this.gameObjectPaperItemCache.get(gameObjectId)!;
    }

    constructor(
        layerId: string,
        scope: paper.PaperScope,
        paperLayer: paper.Layer,
    ) {
        this.id = layerId;
        this.scope = scope;
        this.paperLayer = paperLayer;

        this.paperLayer.name = this.name;
    }

    get name(): string {
        return store.getState().layers.byId[this.id].name;
    }

    get gameObjects(): ReadonlyArray<IGameObject> {
        const state = store.getState();
        const layer = state.layers.byId[this.id];
        if (!layer) return [];

        return layer.gameObjectIds.map(
            (goId) =>
                new GameObject(goId, this.scope, this.paperLayer, this.getPaperItemById(goId))
        );
    }

    get visible(): boolean {
        return store.getState().layers.byId[this.id].visible;
    }

    set visible(v: boolean) {
        store.dispatch(setLayerVisible({ layerId: this.id, visible: v }));
        this.paperLayer.visible = v;
    }

    get locked(): boolean {
        return store.getState().layers.byId[this.id].locked;
    }

    set locked(v: boolean) {
        store.dispatch(setLayerLocked({ layerId: this.id, locked: v }));
        this.paperLayer.locked = v;
    }

    addGameObject(name: string, item: paper.Item): IGameObject {
        const action = createGameObject(name, this.id);
        const { id: gameObjectId } = store.dispatch(action).payload;

        store.dispatch(
            addGameObjectToLayer({ layerId: this.id, gameObjectId })
        );

        this.gameObjectPaperItemCache.set(gameObjectId, item);

        const gameObject = new GameObject(
            gameObjectId,
            this.scope,
            this.paperLayer,
            item
        );

        return gameObject;
    }

    removeGameObject(gameObject: IGameObject): void {
        const go = gameObject as GameObject;

        store.dispatch(
            removeGameObjectFromLayer({
                layerId: this.id,
                gameObjectId: go.id,
            })
        );

        store.dispatch(deleteGameObject(go.id));

        go.destroy();
    }

    findGameObject(name: string): IGameObject | undefined {
        return this.gameObjects.find((obj) => obj.name === name);
    }

    destroy(): void {
        this.gameObjects.forEach((obj) => {
            const go = obj as GameObject;
            store.dispatch(
                removeGameObjectFromLayer({
                    layerId: this.id,
                    gameObjectId: go.id,
                })
            );
            store.dispatch(deleteGameObject(go.id));
            go.destroy();
        });

        this.paperLayer.remove();
    }
}