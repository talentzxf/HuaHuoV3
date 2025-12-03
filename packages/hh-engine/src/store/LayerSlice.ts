import {createSlice, nanoid, PayloadAction} from "@reduxjs/toolkit";

interface LayerSlice {
    id: string;
    name: string;
    gameObjectIds: string[];
    visible: boolean;
    locked: boolean;
    hasTimeline: boolean;      // Whether this layer should be shown in timeline
}

export interface LayerState {
    byId: Record<string, LayerSlice>;
}

const initialState: LayerState = {
    byId: {}
};

const layerSlice = createSlice({
    name: "layers",
    initialState,
    reducers: {
        createLayer: {
            reducer(
                state,
                action: PayloadAction<{ id: string; name: string }>
            ) {
                const { id, name } = action.payload;
                state.byId[id] = {
                    id,
                    name,
                    gameObjectIds: [],
                    visible: true,
                    locked: false,
                    hasTimeline: true  // Default: show in timeline
                };
            },
            prepare(name: string) {
                return { payload: { id: nanoid(), name } };
            }
        },

        deleteLayer(state, action: PayloadAction<string>) {
            delete state.byId[action.payload];
        },

        renameLayer(
            state,
            action: PayloadAction<{ layerId: string; name: string }>
        ) {
            const { layerId, name } = action.payload;
            if (state.byId[layerId]) {
                state.byId[layerId].name = name;
            }
        },

        setLayerVisible(
            state,
            action: PayloadAction<{ layerId: string; visible: boolean }>
        ) {
            const { layerId, visible } = action.payload;
            state.byId[layerId].visible = visible;
        },

        setLayerLocked(
            state,
            action: PayloadAction<{ layerId: string; locked: boolean }>
        ) {
            const { layerId, locked } = action.payload;
            state.byId[layerId].locked = locked;
        },

        addGameObjectToLayer(
            state,
            action: PayloadAction<{ layerId: string; gameObjectId: string }>
        ) {
            const { layerId, gameObjectId } = action.payload;
            state.byId[layerId].gameObjectIds.push(gameObjectId);
        },

        removeGameObjectFromLayer(
            state,
            action: PayloadAction<{ layerId: string; gameObjectId: string }>
        ) {
            const { layerId, gameObjectId } = action.payload;
            const layer = state.byId[layerId];
            layer.gameObjectIds = layer.gameObjectIds.filter(id => id !== gameObjectId);
        },

        setLayerHasTimeline(
            state,
            action: PayloadAction<{ layerId: string; hasTimeline: boolean }>
        ) {
            const { layerId, hasTimeline } = action.payload;
            if (state.byId[layerId]) {
                state.byId[layerId].hasTimeline = hasTimeline;
            }
        }
    }
});

export const {
    createLayer,
    deleteLayer,
    renameLayer,
    setLayerVisible,
    setLayerLocked,
    addGameObjectToLayer,
    removeGameObjectFromLayer,
    setLayerHasTimeline
} = layerSlice.actions;

export default layerSlice.reducer;