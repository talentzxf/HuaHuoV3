import { createSlice } from '@reduxjs/toolkit';

interface CanvasState {
  needsRefresh: boolean;
}

const initialState: CanvasState = {
  needsRefresh: false,
};

export const canvasSlice = createSlice({
  name: 'canvas',
  initialState,
  reducers: {
    requestCanvasRefresh: (state) => {
      state.needsRefresh = true;
    },
    clearCanvasRefreshFlag: (state) => {
      state.needsRefresh = false;
    },
  },
});

export const { requestCanvasRefresh, clearCanvasRefreshFlag } = canvasSlice.actions;
export default canvasSlice.reducer;

