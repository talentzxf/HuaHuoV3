import { configureStore } from '@reduxjs/toolkit';
import { authSlice, appSlice } from '@huahuo/hh-common';
import counterReducer from './features/counter/counterSlice';

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    app: appSlice.reducer,
    counter: counterReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

