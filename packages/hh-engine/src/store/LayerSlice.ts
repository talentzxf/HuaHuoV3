import {createSlice, nanoid, PayloadAction} from "@reduxjs/toolkit";

export interface TimelineClip {
    id: string;
    startFrame: number;
    length: number;
}

interface LayerSlice {
    id: string;
    name: string;
    gameObjectIds: string[];
    visible: boolean;
    locked: boolean;
    hasTimeline: boolean;      // Whether this layer should be shown in timeline
    clips: TimelineClip[];     // Animation clips on timeline
}

export interface LayerState {
    byId: Record<string, LayerSlice>;
}

const initialState: LayerState = {
    byId: {}
};

const layerSlice = createSlice({
    name: "layers",
    initialState,
    reducers: {
        createLayer: {
            reducer(
                state,
                action: PayloadAction<{ id: string; name: string }>
            ) {
                const { id, name } = action.payload;
                state.byId[id] = {
                    id,
                    name,
                    gameObjectIds: [],
                    visible: true,
                    locked: false,
                    hasTimeline: true,  // Default: show in timeline
                    clips: []           // Initialize empty clips array
                };
            },
            prepare(name: string) {
                return { payload: { id: nanoid(), name } };
            }
        },

        deleteLayer(state, action: PayloadAction<string>) {
            delete state.byId[action.payload];
        },

        renameLayer(
            state,
            action: PayloadAction<{ layerId: string; name: string }>
        ) {
            const { layerId, name } = action.payload;
            if (state.byId[layerId]) {
                state.byId[layerId].name = name;
            }
        },

        setLayerVisible(
            state,
            action: PayloadAction<{ layerId: string; visible: boolean }>
        ) {
            const { layerId, visible } = action.payload;
            state.byId[layerId].visible = visible;
        },

        setLayerLocked(
            state,
            action: PayloadAction<{ layerId: string; locked: boolean }>
        ) {
            const { layerId, locked } = action.payload;
            state.byId[layerId].locked = locked;
        },

        addGameObjectToLayer(
            state,
            action: PayloadAction<{ layerId: string; gameObjectId: string }>
        ) {
            const { layerId, gameObjectId } = action.payload;
            state.byId[layerId].gameObjectIds.push(gameObjectId);
        },

        removeGameObjectFromLayer(
            state,
            action: PayloadAction<{ layerId: string; gameObjectId: string }>
        ) {
            const { layerId, gameObjectId } = action.payload;
            const layer = state.byId[layerId];
            layer.gameObjectIds = layer.gameObjectIds.filter(id => id !== gameObjectId);
        },

        setLayerHasTimeline(
            state,
            action: PayloadAction<{ layerId: string; hasTimeline: boolean }>
        ) {
            const { layerId, hasTimeline } = action.payload;
            if (state.byId[layerId]) {
                state.byId[layerId].hasTimeline = hasTimeline;
            }
        },

        addTimelineClip: {
            reducer(
                state,
                action: PayloadAction<{ layerId: string; clipId: string; startFrame: number; length: number }>
            ) {
                const { layerId, clipId, startFrame, length } = action.payload;
                const layer = state.byId[layerId];
                if (!layer) return;

                const endFrame = startFrame + length - 1;

                // Find all overlapping clips
                const overlappingClips: number[] = [];
                let mergedStartFrame = startFrame;
                let mergedEndFrame = endFrame;

                layer.clips.forEach((clip, index) => {
                    const clipEnd = clip.startFrame + clip.length - 1;
                    // Check if clips overlap or are adjacent
                    if (!(endFrame < clip.startFrame || startFrame > clipEnd)) {
                        overlappingClips.push(index);
                        mergedStartFrame = Math.min(mergedStartFrame, clip.startFrame);
                        mergedEndFrame = Math.max(mergedEndFrame, clipEnd);
                    }
                });

                if (overlappingClips.length > 0) {
                    // Remove all overlapping clips (in reverse order to maintain indices)
                    for (let i = overlappingClips.length - 1; i >= 0; i--) {
                        layer.clips.splice(overlappingClips[i], 1);
                    }

                    console.log(`✓ Merged ${overlappingClips.length} overlapping clip(s) with new clip`);
                }

                // Add the merged clip
                const mergedClip = {
                    id: clipId,
                    startFrame: mergedStartFrame,
                    length: mergedEndFrame - mergedStartFrame + 1
                };

                layer.clips.push(mergedClip);

                console.log(`✓ TimelineClip added successfully:`, {
                    layerId,
                    clipId,
                    startFrame: mergedClip.startFrame,
                    length: mergedClip.length,
                    totalClips: layer.clips.length
                });
            },
            prepare(layerId: string, startFrame: number, length: number) {
                return { payload: { layerId, clipId: nanoid(), startFrame, length } };
            }
        },

        removeTimelineClip(
            state,
            action: PayloadAction<{ layerId: string; clipId: string }>
        ) {
            const { layerId, clipId } = action.payload;
            const layer = state.byId[layerId];
            if (!layer) return;

            layer.clips = layer.clips.filter(clip => clip.id !== clipId);
        },

        updateTimelineClip(
            state,
            action: PayloadAction<{ layerId: string; clipId: string; startFrame?: number; length?: number }>
        ) {
            const { layerId, clipId, startFrame, length } = action.payload;
            const layer = state.byId[layerId];
            if (!layer) return;

            const clipIndex = layer.clips.findIndex(clip => clip.id === clipId);
            if (clipIndex === -1) return;

            const updatedClip = { ...layer.clips[clipIndex] };
            if (startFrame !== undefined) updatedClip.startFrame = startFrame;
            if (length !== undefined) updatedClip.length = length;

            const endFrame = updatedClip.startFrame + updatedClip.length;

            // Check for overlaps with other clips (excluding the current one)
            const hasOverlap = layer.clips.some((clip, index) => {
                if (index === clipIndex) return false;
                const clipEnd = clip.startFrame + clip.length;
                return !(endFrame <= clip.startFrame || updatedClip.startFrame >= clipEnd);
            });

            if (hasOverlap) {
                console.warn(`Cannot update clip: would overlap with existing clip on layer ${layerId}`);
                return;
            }

            layer.clips[clipIndex] = updatedClip;
        },

        moveTimelineClip(
            state,
            action: PayloadAction<{ layerId: string; clipId: string; newStartFrame: number }>
        ) {
            const { layerId, clipId, newStartFrame } = action.payload;
            const layer = state.byId[layerId];
            if (!layer) return;

            const clipIndex = layer.clips.findIndex(clip => clip.id === clipId);
            if (clipIndex === -1) return;

            const clip = layer.clips[clipIndex];
            const endFrame = newStartFrame + clip.length;

            // Check for overlaps with other clips (excluding the current one)
            const hasOverlap = layer.clips.some((otherClip, index) => {
                if (index === clipIndex) return false;
                const clipEnd = otherClip.startFrame + otherClip.length;
                return !(endFrame <= otherClip.startFrame || newStartFrame >= clipEnd);
            });

            if (hasOverlap) {
                console.warn(`Cannot move clip: would overlap with existing clip on layer ${layerId}`);
                return;
            }

            layer.clips[clipIndex].startFrame = newStartFrame;
        },

        splitTimelineClip: {
            reducer(
                state,
                action: PayloadAction<{
                    layerId: string;
                    clipId: string;
                    splitFrame: number;
                    newClipId1: string;
                    newClipId2: string;
                }>
            ) {
                const { layerId, clipId, splitFrame, newClipId1, newClipId2 } = action.payload;
                const layer = state.byId[layerId];
                if (!layer) return;

                const clipIndex = layer.clips.findIndex(clip => clip.id === clipId);
                if (clipIndex === -1) return;

                const clip = layer.clips[clipIndex];
                const clipEndFrame = clip.startFrame + clip.length - 1;

                // Validate split frame is within clip bounds (not at edges)
                if (splitFrame <= clip.startFrame || splitFrame > clipEndFrame) {
                    console.warn(`Cannot split clip: frame ${splitFrame} is not inside clip range [${clip.startFrame}, ${clipEndFrame}]`);
                    return;
                }

                // Create two new clips
                const clip1 = {
                    id: newClipId1,
                    startFrame: clip.startFrame,
                    length: splitFrame - clip.startFrame
                };

                const clip2 = {
                    id: newClipId2,
                    startFrame: splitFrame,
                    length: clipEndFrame - splitFrame + 1
                };

                // Remove original clip and add two new clips
                layer.clips.splice(clipIndex, 1, clip1, clip2);

                console.log(`✓ TimelineClip split successfully:`, {
                    layerId,
                    originalClip: { id: clipId, startFrame: clip.startFrame, length: clip.length },
                    clip1: { id: clip1.id, startFrame: clip1.startFrame, length: clip1.length },
                    clip2: { id: clip2.id, startFrame: clip2.startFrame, length: clip2.length },
                    totalClips: layer.clips.length
                });
            },
            prepare(layerId: string, clipId: string, splitFrame: number) {
                return {
                    payload: {
                        layerId,
                        clipId,
                        splitFrame,
                        newClipId1: nanoid(),
                        newClipId2: nanoid()
                    }
                };
            }
        }
    }
});

export const {
    createLayer,
    deleteLayer,
    renameLayer,
    setLayerVisible,
    setLayerLocked,
    addGameObjectToLayer,
    removeGameObjectFromLayer,
    setLayerHasTimeline,
    addTimelineClip,
    removeTimelineClip,
    updateTimelineClip,
    moveTimelineClip,
    splitTimelineClip
} = layerSlice.actions;

export default layerSlice.reducer;