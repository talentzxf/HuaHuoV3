// src/store/store.ts
import { configureStore } from "@reduxjs/toolkit";

import sceneReducer from "./SceneSlice";
import layerReducer from "./LayerSlice";
import gameObjectReducer from "./GameObjectSlice";
import componentReducer from "./ComponentSlice";

export const store = configureStore({
    reducer: {
        scenes: sceneReducer,
        layers: layerReducer,
        gameObjects: gameObjectReducer,
        components: componentReducer
    },
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
            serializableCheck: false
        }),
    devTools: true
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;