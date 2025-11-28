import {createSlice, nanoid, PayloadAction} from "@reduxjs/toolkit";

interface SceneSlice {
    id: string;
    name: string;
    layerIds: string[];
}

export interface SceneState {
    byId: Record<string, SceneSlice>;
    currentSceneId: string | null;
}

const initialState: SceneState = {
    byId: {},
    currentSceneId: null
}

const sceneSlice = createSlice({
    name: 'scenes',
    initialState,
    reducers: {
        createScene: {
            reducer(state: SceneState, action: PayloadAction<SceneSlice>) {
                const {id, name, layerIds} = action.payload;
                state.byId[id] = {id, name, layerIds};

                if (!state.currentSceneId) {
                    state.currentSceneId = id;
                }
            },
            prepare(name: string) {
                return {payload: {id: nanoid(), name, layerIds: []}};
            }
        },
        setCurrentScene(state: SceneState, action: PayloadAction<string>) {
            state.currentSceneId = action.payload;
        },
        addLayerToScene(
            state: SceneState,
            action: PayloadAction<{ sceneId: string; layerId: string }>
        ) {
            const {sceneId, layerId} = action.payload;
            const scene = state.byId[sceneId];
            if (!scene) return;

            if (!scene.layerIds.includes(layerId)) {
                scene.layerIds.push(layerId);
            }
        },
    }
});

export default sceneSlice.reducer;
export const {createScene, setCurrentScene, addLayerToScene} = sceneSlice.actions;

