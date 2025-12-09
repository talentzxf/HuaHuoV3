import { configureStore } from '@reduxjs/toolkit';
import { authSlice, appSlice } from '@huahuo/hh-common';
import counterReducer from './features/counter/counterSlice';
import selectionReducer from './features/selection/selectionSlice';

// Import unified engine reducer
import { engineReducer } from '@huahuo/engine';

export const store = configureStore({
  reducer: {
    // IDE-specific reducers
    auth: authSlice.reducer,
    app: appSlice.reducer,
    counter: counterReducer,
    selection: selectionReducer,

    // Engine reducer (unified, encapsulates internal structure)
    // Engine's playback state is used for play/pause control
    engine: engineReducer,
  },
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false
    }),
  devTools: true,
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

