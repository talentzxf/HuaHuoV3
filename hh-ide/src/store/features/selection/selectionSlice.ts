import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type SelectionType = 'gameObject' | 'layer' | 'vertex' | 'edge' | 'scene' | null;

interface SelectionState {
  selectedType: SelectionType;
  selectedId: string | null;
}

const initialState: SelectionState = {
  selectedType: null,
  selectedId: null,
};

export const selectionSlice = createSlice({
  name: 'selection',
  initialState,
  reducers: {
    selectObject: (state, action: PayloadAction<{ type: SelectionType; id: string | null }>) => {
      state.selectedType = action.payload.type;
      state.selectedId = action.payload.id;
    },
    clearSelection: (state) => {
      state.selectedType = null;
      state.selectedId = null;
    },
  },
});

export const { selectObject, clearSelection } = selectionSlice.actions;
export default selectionSlice.reducer;

