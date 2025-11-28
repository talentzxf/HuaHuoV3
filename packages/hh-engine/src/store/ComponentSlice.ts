import { createSlice, PayloadAction, nanoid } from "@reduxjs/toolkit";

export interface ComponentSlice {
    id: string;
    type: string;                        // Component type name
    parentId: string;                    // GameObject ID
    enabled: boolean;
    props: Record<string, any>;          // component-specific data
}

export interface ComponentState {
    byId: Record<string, ComponentSlice>;
}

const initialState: ComponentState = {
    byId: {}
};

const componentSlice = createSlice({
    name: "components",
    initialState,
    reducers: {
        createComponent: {
            reducer(
                state,
                action: PayloadAction<{
                    id: string;
                    type: string;
                    parentId: string;
                    initialProps: Record<string, any>;
                }>
            ) {
                const { id, type, parentId, initialProps } = action.payload;

                state.byId[id] = {
                    id,
                    type,
                    parentId,
                    enabled: true,
                    props: { ...initialProps }
                };
            },
            prepare(type: string, parentId: string, initialProps: Record<string, any>) {
                return {
                    payload: {
                        id: nanoid(),
                        type,
                        parentId,
                        initialProps
                    }
                };
            }
        },

        deleteComponent(state, action: PayloadAction<string>) {
            delete state.byId[action.payload];
        },

        setComponentEnabled(
            state,
            action: PayloadAction<{ id: string; enabled: boolean }>
        ) {
            const { id, enabled } = action.payload;
            if (state.byId[id]) {
                state.byId[id].enabled = enabled;
            }
        },

        updateComponentProps(
            state,
            action: PayloadAction<{ id: string; patch: Record<string, any> }>
        ) {
            const { id, patch } = action.payload;
            if (state.byId[id]) {
                Object.assign(state.byId[id].props, patch);
            }
        },

        reparentComponent(
            state,
            action: PayloadAction<{ id: string; parentId: string }>
        ) {
            const { id, parentId } = action.payload;
            if (state.byId[id]) {
                state.byId[id].parentId = parentId;
            }
        }
    }
});

export const {
    createComponent,
    deleteComponent,
    setComponentEnabled,
    updateComponentProps,
    reparentComponent
} = componentSlice.actions;

export default componentSlice.reducer;