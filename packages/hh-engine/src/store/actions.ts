// Composite actions that coordinate multiple reducers
import { updateComponentProps, setPropertyKeyFrame } from './ComponentSlice';
import { addKeyFrame } from './LayerSlice';
import { updateProjectTotalFrames } from './ProjectSlice';

/**
 * Find the Layer that contains the given GameObject by traversing up the parent chain
 * @param gameObjectId - The GameObject ID to find the layer for
 * @param engineState - The engine state
 * @returns layerId if found, null otherwise
 */
function findLayerForGameObject(gameObjectId: string, engineState: any): string | null {
    const gameObject = engineState.gameObjects.byId[gameObjectId];
    if (!gameObject || !gameObject.parent) {
        return null;
    }

    let currentParent = gameObject.parent;
    let traverseCount = 0;
    const maxTraverse = 100; // Prevent infinite loop

    while (traverseCount < maxTraverse) {
        // Check if currentParent is a layer
        if (engineState.layers.byId[currentParent]) {
            return currentParent;
        }

        // Check if currentParent is a GameObject, continue traversing up
        const parentGameObject = engineState.gameObjects.byId[currentParent];
        if (parentGameObject && parentGameObject.parent) {
            currentParent = parentGameObject.parent;
            traverseCount++;
        } else {
            // No parent found, stop
            break;
        }
    }

    return null;
}

/**
 * Update component props and automatically add keyframe at current frame
 * This will:
 * 1. Update the component props immediately
 * 2. Set keyframes for each changed property at the current frame
 * 3. Add a keyframe marker to the layer's timeline
 */
export const updateComponentPropsWithKeyFrame = (payload: {
    id: string;
    patch: Record<string, any>;
}) => {
    return (dispatch: any, getState: any) => {
        const { id, patch } = payload;

        // Get current state
        const state = getState();
        const engineState = state.engine || state;
        const currentFrame = engineState.playback.currentFrame;

        // Update component props immediately
        dispatch(updateComponentProps({ id, patch }));

        // Set keyframes for each property in the patch
        for (const propName in patch) {
            dispatch(setPropertyKeyFrame({
                componentId: id,
                propName: propName,
                frame: currentFrame,
                value: patch[propName]
            }));
        }

        // Add keyframe marker to the layer's timeline
        const component = engineState.components.byId[id];
        if (!component) return;

        const layerId = findLayerForGameObject(component.parentId, engineState);
        if (layerId) {
            dispatch(addKeyFrame({
                layerId,
                frame: currentFrame,
                gameObjectId: component.parentId
            }));
        }
    };
};

/**
 * Calculate and update project total frames based on last keyframe or clip
 * Automatically extends project duration to include all content
 */
export const calculateAndUpdateTotalFrames = () => {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const engineState = state.engine || state;

        let maxFrame = 120; // Default minimum

        // Check all layers for clips and keyframes
        Object.values(engineState.layers.byId).forEach((layer: any) => {
            // Check clips
            if (layer.clips) {
                layer.clips.forEach((clip: any) => {
                    const clipEnd = clip.startFrame + clip.length - 1;
                    maxFrame = Math.max(maxFrame, clipEnd);
                });
            }

            // Check keyframes
            if (layer.keyFrames) {
                layer.keyFrames.forEach((kf: any) => {
                    maxFrame = Math.max(maxFrame, kf.frame);
                });
            }
        });

        // Check all components for property keyframes
        Object.values(engineState.components.byId).forEach((component: any) => {
            if (component.keyFrames) {
                Object.values(component.keyFrames).forEach((keyFrames: any) => {
                    if (Array.isArray(keyFrames)) {
                        keyFrames.forEach((kf: any) => {
                            maxFrame = Math.max(maxFrame, kf.frame);
                        });
                    }
                });
            }
        });

        // Add some buffer (e.g., 10 frames) and update
        const totalFrames = maxFrame + 10;
        dispatch(updateProjectTotalFrames({ totalFrames }));

        console.log(`[Project] Auto-calculated total frames: ${totalFrames} (last content at frame ${maxFrame})`);
    };
};




