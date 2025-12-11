import { createListenerMiddleware } from '@reduxjs/toolkit';

// Create listener middleware instance
export const keyframeListenerMiddleware = createListenerMiddleware();

export const startAppListening = keyframeListenerMiddleware.startListening;

// Keyframe-related action types (only react to these)
export const KEYFRAME_ACTION_TYPES = [
  'components/setPropertyKeyFrame',
  'components/removePropertyKeyFrame',
  'components/clearPropertyKeyFrames',
  'components/setKeyFrameEasing',
  'components/createComponent',
  'components/deleteComponent',
];

// Event emitter for keyframe changes (to notify React components)
type KeyframeChangeListener = (gameObjectId: string) => void;
const keyframeChangeListeners = new Set<KeyframeChangeListener>();

export const subscribeToKeyframeChanges = (listener: KeyframeChangeListener) => {
  keyframeChangeListeners.add(listener);
  return () => {
    keyframeChangeListeners.delete(listener);
  };
};

const notifyKeyframeChange = (gameObjectId: string) => {
  keyframeChangeListeners.forEach(listener => listener(gameObjectId));
};

// Setup keyframe change listener
export const setupKeyframeListener = () => {
  // Listen to all keyframe-related actions
  startAppListening({
    predicate: (action: any) => {
      // ✅ Only react to keyframe-related actions
      return KEYFRAME_ACTION_TYPES.includes(action.type);
    },
    effect: (action: any, listenerApi) => {
      // Get the current state
      const state = listenerApi.getState() as any;
      const engineState = state.engine;

      // Find which GameObject was affected
      // For component actions, we need to find the GameObject that owns the component
      if (action.type.startsWith('components/')) {
        const componentId = action.payload?.id;
        if (componentId) {
          const component = engineState.components.byId[componentId];
          if (component) {
            // parentId on component is the GameObject ID
            const gameObjectId = component.parentId;
            if (gameObjectId) {
              notifyKeyframeChange(gameObjectId);
            }
          }
        }
      }

      // For actions that might affect multiple GameObjects, notify all
      // (This is a fallback - ideally we should be more specific)
      if (!action.payload?.id) {
        const gameObjectIds = Object.keys(engineState.gameObjects.byId);
        gameObjectIds.forEach(id => notifyKeyframeChange(id));
      }
    }
  });
};
