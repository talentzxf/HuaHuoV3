import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface PlaybackState {
  isPlaying: boolean;
}

const initialState: PlaybackState = {
  isPlaying: false,
};

export const playbackSlice = createSlice({
  name: 'playback',
  initialState,
  reducers: {
    setPlaying: (state, action: PayloadAction<boolean>) => {
      state.isPlaying = action.payload;
    },
    togglePlaying: (state) => {
      state.isPlaying = !state.isPlaying;
    },
  },
});

export const { setPlaying, togglePlaying } = playbackSlice.actions;
export default playbackSlice.reducer;

