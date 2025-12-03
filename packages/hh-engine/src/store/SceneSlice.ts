import {createSlice, nanoid, PayloadAction} from "@reduxjs/toolkit";

interface SceneSlice {
    id: string;
    name: string;
    layerIds: string[];
    duration: number; // Animation duration in seconds
    fps: number; // Frames per second
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
                const {id, name, layerIds, duration, fps} = action.payload;
                state.byId[id] = {id, name, layerIds, duration, fps};

                if (!state.currentSceneId) {
                    state.currentSceneId = id;
                }
            },
            prepare(name: string) {
                return {payload: {id: nanoid(), name, layerIds: [], duration: 5.0, fps: 30}};
            }
        },
        setCurrentScene(state: SceneState, action: PayloadAction<string>) {
            state.currentSceneId = action.payload;
        },
        setSceneName(
            state: SceneState,
            action: PayloadAction<{ sceneId: string; name: string }>
        ) {
            const {sceneId, name} = action.payload;
            const scene = state.byId[sceneId];
            if (scene) {
                scene.name = name;
            }
        },
        setDuration(
            state: SceneState,
            action: PayloadAction<{ sceneId: string; duration: number }>
        ) {
            const {sceneId, duration} = action.payload;
            const scene = state.byId[sceneId];
            if (scene) {
                scene.duration = duration;
            }
        },
        setFps(
            state: SceneState,
            action: PayloadAction<{ sceneId: string; fps: number }>
        ) {
            const {sceneId, fps} = action.payload;
            const scene = state.byId[sceneId];
            if (scene) {
                scene.fps = fps;
            }
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
export const {createScene, setCurrentScene, setSceneName, setDuration, setFps, addLayerToScene} = sceneSlice.actions;

