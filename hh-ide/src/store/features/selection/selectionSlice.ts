import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface SelectionState {
  selectedGameObjectId: string | null;
}

const initialState: SelectionState = {
  selectedGameObjectId: null,
};

export const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    selectGameObject: (state, action: PayloadAction<string | null>) => {
      state.selectedGameObjectId = action.payload;
    },
    clearSelection: (state) => {
      state.selectedGameObjectId = null;
    },
  },
});

export const { selectGameObject, clearSelection } = selectionSlice.actions;
export default selectionSlice.reducer;

