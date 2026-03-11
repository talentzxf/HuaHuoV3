import { configureStore } from '@reduxjs/toolkit';
import { authSlice, appSlice } from '@huahuo/hh-common';
import counterReducer from './features/counter/counterSlice';
import selectionReducer from './features/selection/selectionSlice';
import canvasReducer from './features/canvas/canvasSlice';

// NOTE: The engine's data layer has moved to Rust/WASM (KernelBridge).
// Only UI-only slices remain in Redux.
// Engine state (project, scenes, layers, gameObjects, components, playback)
// is accessed via getKernel() from @huahuo/engine.

export const store = configureStore({
  reducer: {
    // IDE-only UI state
    auth: authSlice.reducer,
    app: appSlice.reducer,
    counter: counterReducer,
    selection: selectionReducer,
    canvas: canvasReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({ serializableCheck: false }),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
