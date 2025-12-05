import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface PlaybackState {
    currentFrame: number;
    isPlaying: boolean;
    fps: number;
}

const initialState: PlaybackState = {
    currentFrame: 0,
    isPlaying: false,
    fps: 30
};

const playbackSlice = createSlice({
    name: 'playback',
    initialState,
    reducers: {
        setCurrentFrame(state, action: PayloadAction<number>) {
            state.currentFrame = action.payload;
        },

        setPlaybackFps(state, action: PayloadAction<number>) {
            state.fps = action.payload;
        },

        play(state) {
            state.isPlaying = true;
        },

        pause(state) {
            state.isPlaying = false;
        },

        stop(state) {
            state.isPlaying = false;
            state.currentFrame = 0;
        }
    }
});

export const {
    setCurrentFrame,
    setPlaybackFps,
    play,
    pause,
    stop
} = playbackSlice.actions;

export default playbackSlice.reducer;

