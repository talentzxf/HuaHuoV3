import { configureStore } from '@reduxjs/toolkit';
import { authSlice, appSlice } from '@huahuo/hh-common';
import counterReducer from './features/counter/counterSlice';
import selectionReducer from './features/selection/selectionSlice';
import canvasReducer from './features/canvas/canvasSlice';

// Import unified engine reducer
import { engineReducer } from '@huahuo/engine';

// Import listener middlewares
import { keyframeListenerMiddleware, setupKeyframeListener } from './listeners/keyframeListener';
import { gameObjectListenerMiddleware, setupGameObjectListener } from './listeners/gameObjectListener';

// Debug: Check if middlewares are properly created
console.log('keyframeListenerMiddleware:', keyframeListenerMiddleware);
console.log('gameObjectListenerMiddleware:', gameObjectListenerMiddleware);
console.log('keyframeListenerMiddleware.middleware:', keyframeListenerMiddleware?.middleware);
console.log('gameObjectListenerMiddleware.middleware:', gameObjectListenerMiddleware?.middleware);

export const store = configureStore({
  reducer: {
    // IDE-specific reducers
    auth: authSlice.reducer,
    app: appSlice.reducer,
    counter: counterReducer,
    selection: selectionReducer,
    canvas: canvasReducer,

    // Engine reducer (unified, encapsulates internal structure)
    // Engine's playback state is used for play/pause control
    engine: engineReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false
    }).prepend(
      keyframeListenerMiddleware.middleware,
      gameObjectListenerMiddleware.middleware
    ),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Setup listeners
setupKeyframeListener();
setupGameObjectListener();

