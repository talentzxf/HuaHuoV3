// Composite actions that coordinate multiple reducers
import { updateComponentProps, setPropertyKeyFrame } from './ComponentSlice';
import { addKeyFrame } from './LayerSlice';
import { updateProjectTotalFrames } from './ProjectSlice';
import { setDuration as setSceneDuration, setFps as setSceneFps } from './SceneSlice';
import { play as playAction, pause as pauseAction, stop as stopAction } from './PlaybackSlice';
import { getAnimationPlayer } from '../core/AnimationPlayer';

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
 * Set Scene duration and auto-expand Project totalFrames if needed
 * Only expands, never shrinks (to preserve content that might be beyond the scene duration)
 */
export const setSceneDurationAndExpandProject = (sceneId: string, duration: number) => {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const engineState = state.engine || state;

        // Get scene
        const scene = engineState.scenes.byId[sceneId];
        if (!scene) {
            console.warn('[setSceneDurationAndExpandProject] Scene not found:', sceneId);
            return;
        }

        // Calculate required frames for this Scene
        const requiredFrames = Math.ceil(duration * scene.fps);

        // Update Scene duration
        dispatch(setSceneDuration({ sceneId, duration }));

        // Check if we need to expand Project totalFrames
        const project = engineState.project.current;
        if (project && requiredFrames > project.totalFrames) {
            console.log(`[setSceneDurationAndExpandProject] Expanding Project totalFrames: ${project.totalFrames} → ${requiredFrames}`);
            dispatch(updateProjectTotalFrames({ totalFrames: requiredFrames }));
        } else if (project) {
            console.log(`[setSceneDurationAndExpandProject] No expansion needed. Scene needs ${requiredFrames} frames, Project has ${project.totalFrames}`);
        }
    };
};

/**
 * Set Scene fps and auto-expand Project totalFrames if needed
 * Only expands, never shrinks
 */
export const setSceneFpsAndExpandProject = (sceneId: string, fps: number) => {
    return (dispatch: any, getState: any) => {
        const state = getState();
        const engineState = state.engine || state;

        // Get scene
        const scene = engineState.scenes.byId[sceneId];
        if (!scene) {
            console.warn('[setSceneFpsAndExpandProject] Scene not found:', sceneId);
            return;
        }

        // Calculate required frames for this Scene
        const requiredFrames = Math.ceil(scene.duration * fps);

        // Update Scene fps
        dispatch(setSceneFps({ sceneId, fps }));

        // Check if we need to expand Project totalFrames
        const project = engineState.project.current;
        if (project && requiredFrames > project.totalFrames) {
            console.log(`[setSceneFpsAndExpandProject] Expanding Project totalFrames: ${project.totalFrames} → ${requiredFrames}`);
            dispatch(updateProjectTotalFrames({ totalFrames: requiredFrames }));
        } else if (project) {
            console.log(`[setSceneFpsAndExpandProject] No expansion needed. Scene needs ${requiredFrames} frames, Project has ${project.totalFrames}`);
        }
    };
};

/**
 * Play animation
 * Updates playback state and starts AnimationPlayer
 */
export const playAnimation = () => {
    return (dispatch: any) => {
        dispatch(playAction());
        const player = getAnimationPlayer();
        player.play();
    };
};

/**
 * Pause animation
 * Updates playback state (AnimationPlayer will stop automatically based on isPlaying flag)
 */
export const pauseAnimation = () => {
    return (dispatch: any) => {
        dispatch(pauseAction());
    };
};

/**
 * Stop animation
 * Pauses playback and resets to frame 0
 */
export const stopAnimation = () => {
    return (dispatch: any) => {
        console.log('[stopAnimation] Stopping and resetting to frame 0');
        dispatch(stopAction());
    };
};





