import { createSlice, PayloadAction, nanoid } from "@reduxjs/toolkit";

export interface ProjectSlice {
    id: string;
    name: string;
    sceneIds: string[];        // List of scene IDs in this project
    currentSceneId: string | null;  // Currently active scene
    totalFrames: number;       // Total frames in the project
    fps: number;               // Frames per second
    canvasWidth: number;       // Canvas width
    canvasHeight: number;      // Canvas height
    created: number;           // Timestamp
    modified: number;          // Timestamp
}

export interface ProjectState {
    current: ProjectSlice | null;  // Current project
}

const initialState: ProjectState = {
    current: null
};

const projectSlice = createSlice({
    name: "project",
    initialState,
    reducers: {
        createProject: {
            reducer(
                state,
                action: PayloadAction<{
                    id: string;
                    name: string;
                    fps: number;
                    canvasWidth: number;
                    canvasHeight: number;
                }>
            ) {
                const { id, name, fps, canvasWidth, canvasHeight } = action.payload;
                const now = Date.now();

                state.current = {
                    id,
                    name,
                    sceneIds: [],
                    currentSceneId: null,
                    totalFrames: 120,  // Default: 120 frames (4 seconds at 30fps)
                    fps,
                    canvasWidth,
                    canvasHeight,
                    created: now,
                    modified: now
                };
            },
            prepare(name: string, fps: number = 30, canvasWidth: number = 800, canvasHeight: number = 600) {
                return {
                    payload: {
                        id: nanoid(),
                        name,
                        fps,
                        canvasWidth,
                        canvasHeight
                    }
                };
            }
        },

        addSceneToProject(
            state,
            action: PayloadAction<{ sceneId: string }>
        ) {
            if (state.current) {
                const { sceneId } = action.payload;
                if (!state.current.sceneIds.includes(sceneId)) {
                    state.current.sceneIds.push(sceneId);
                }
                // If no current scene, set this as current
                if (!state.current.currentSceneId) {
                    state.current.currentSceneId = sceneId;
                }
                state.current.modified = Date.now();
            }
        },

        removeSceneFromProject(
            state,
            action: PayloadAction<{ sceneId: string }>
        ) {
            if (state.current) {
                const { sceneId } = action.payload;
                state.current.sceneIds = state.current.sceneIds.filter(id => id !== sceneId);

                // If removing current scene, clear it
                if (state.current.currentSceneId === sceneId) {
                    state.current.currentSceneId = state.current.sceneIds[0] || null;
                }
                state.current.modified = Date.now();
            }
        },

        setProjectCurrentScene(
            state,
            action: PayloadAction<{ sceneId: string }>
        ) {
            if (state.current) {
                const { sceneId } = action.payload;
                if (state.current.sceneIds.includes(sceneId)) {
                    state.current.currentSceneId = sceneId;
                    state.current.modified = Date.now();
                }
            }
        },

        updateProjectName(
            state,
            action: PayloadAction<{ name: string }>
        ) {
            if (state.current) {
                state.current.name = action.payload.name;
                state.current.modified = Date.now();
            }
        },

        updateProjectTotalFrames(
            state,
            action: PayloadAction<{ totalFrames: number }>
        ) {
            if (state.current) {
                state.current.totalFrames = Math.max(1, action.payload.totalFrames);
                state.current.modified = Date.now();
            }
        },

        updateProjectFps(
            state,
            action: PayloadAction<{ fps: number }>
        ) {
            if (state.current) {
                state.current.fps = Math.max(1, Math.min(120, action.payload.fps));
                state.current.modified = Date.now();
            }
        },

        updateProjectCanvasSize(
            state,
            action: PayloadAction<{ width: number; height: number }>
        ) {
            if (state.current) {
                state.current.canvasWidth = Math.max(1, action.payload.width);
                state.current.canvasHeight = Math.max(1, action.payload.height);
                state.current.modified = Date.now();
            }
        },

        /**
         * Auto-calculate total frames based on the last keyframe or clip in all layers
         */
        autoCalculateTotalFrames(state) {
            if (!state.current) return;

            // This will be called with the full engine state
            // The calculation happens in a thunk action
            state.current.modified = Date.now();
        }
    }
});

export const {
    createProject,
    addSceneToProject,
    removeSceneFromProject,
    setProjectCurrentScene,
    updateProjectName,
    updateProjectTotalFrames,
    updateProjectFps,
    updateProjectCanvasSize,
    autoCalculateTotalFrames
} = projectSlice.actions;

export default projectSlice.reducer;

