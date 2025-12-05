import { createSlice, nanoid, PayloadAction } from "@reduxjs/toolkit";

export interface GameObjectSlice {
    id: string;
    name: string;

    active: boolean;
    bornFrameId: number;        // Frame when GameObject starts appearing (0 by default)

    parent: string | null;      // layerId or another gameObjectId
    children: string[];

    componentIds: string[];     // Transform + custom components
}

export interface GameObjectState {
    byId: Record<string, GameObjectSlice>;
}

const initialState: GameObjectState = {
    byId: {}
};

const gameObjectSlice = createSlice({
    name: "gameObjects",
    initialState,
    reducers: {
        createGameObject: {
            reducer(
                state,
                action: PayloadAction<{
                    id: string;
                    name: string;
                    parent: string | null;
                }>
            ) {
                const { id, name, parent } = action.payload;

                state.byId[id] = {
                    id,
                    name,
                    active: true,
                    bornFrameId: 0,      // Default: appears from frame 0
                    parent,
                    children: [],
                    componentIds: []     // Default no component, Transform component added by outer layer
                };

                // 如果有 parent，则将其加入 parent 的 children 数组
                if (parent && state.byId[parent]) {
                    state.byId[parent].children.push(id);
                }
            },
            prepare(name: string, parent: string | null = null) {
                return {
                    payload: {
                        id: nanoid(),
                        name,
                        parent
                    }
                };
            }
        },

        // Won't delete children GameObjects or components; that should be handled externally
        deleteGameObject(state, action: PayloadAction<string>) {
            const id = action.payload;
            const obj = state.byId[id];
            if (!obj) return;

            // 从 parent 的 children 中移除
            if (obj.parent && state.byId[obj.parent]) {
                state.byId[obj.parent].children =
                    state.byId[obj.parent].children.filter(childId => childId !== id);
            }

            delete state.byId[id];
        },

        renameGameObject(
            state,
            action: PayloadAction<{ id: string; name: string }>
        ) {
            const { id, name } = action.payload;
            if (state.byId[id]) {
                state.byId[id].name = name;
            }
        },

        setGameObjectActive(
            state,
            action: PayloadAction<{ id: string; active: boolean }>
        ) {
            const { id, active } = action.payload;
            if (state.byId[id]) {
                state.byId[id].active = active;
            }
        },

        setBornFrameId(
            state,
            action: PayloadAction<{ id: string; bornFrameId: number }>
        ) {
            const { id, bornFrameId } = action.payload;
            if (state.byId[id]) {
                state.byId[id].bornFrameId = bornFrameId;
            }
        },

        // Change Parent (Move GameObject)
        moveGameObject(
            state,
            action: PayloadAction<{ id: string; newParentId: string | null }>
        ) {
            const { id, newParentId } = action.payload;
            const obj = state.byId[id];
            if (!obj) return;

            // Remove from old parent
            if (obj.parent && state.byId[obj.parent]) {
                state.byId[obj.parent].children =
                    state.byId[obj.parent].children.filter(childId => childId !== id);
            }

            // Set new parent
            obj.parent = newParentId;

            // Add to new parent
            if (newParentId && state.byId[newParentId]) {
                state.byId[newParentId].children.push(id);
            }
        },

        // Add Component (only add ID)
        attachComponentToGameObject(
            state,
            action: PayloadAction<{ objectId: string; componentId: string }>
        ) {
            const { objectId, componentId } = action.payload;
            state.byId[objectId].componentIds.push(componentId);
        },

        // Remove Component (only remove ID)
        detachComponentFromGameObject(
            state,
            action: PayloadAction<{ objectId: string; componentId: string }>
        ) {
            const { objectId, componentId } = action.payload;
            state.byId[objectId].componentIds =
                state.byId[objectId].componentIds.filter(id => id !== componentId);
        }
    }
});

export const {
    createGameObject,
    deleteGameObject,
    renameGameObject,
    setGameObjectActive,
    setBornFrameId,
    moveGameObject,
    attachComponentToGameObject,
    detachComponentFromGameObject
} = gameObjectSlice.actions;

export default gameObjectSlice.reducer;