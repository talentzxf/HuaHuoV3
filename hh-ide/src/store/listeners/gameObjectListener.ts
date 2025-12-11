import { createListenerMiddleware } from '@reduxjs/toolkit';

// Create listener middleware instance
export const gameObjectListenerMiddleware = createListenerMiddleware();

export const startAppListening = gameObjectListenerMiddleware.startListening;

// Actions that should trigger GameObject panel updates
const GAMEOBJECT_RELATED_ACTIONS = [
  // GameObject changes
  'gameObjects/updateGameObject',
  'gameObjects/deleteGameObject',
  'gameObjects/setGameObjectActive',
  'gameObjects/reparentGameObject',

  // Component changes that affect properties
  'components/updateComponentProps',
  'components/createComponent',
  'components/deleteComponent',
  'components/setComponentEnabled',
  'components/reparentComponent',

  // Keyframe changes (affect property values)
  'components/setPropertyKeyFrame',
  'components/removePropertyKeyFrame',
  'components/clearPropertyKeyFrames',
  'components/setKeyFrameEasing',
];

// Event emitter for GameObject changes (to notify React components)
type GameObjectChangeListener = (event: { type: string; gameObjectId?: string }) => void;
const gameObjectChangeListeners = new Set<GameObjectChangeListener>();

export const subscribeToGameObjectChanges = (listener: GameObjectChangeListener) => {
  gameObjectChangeListeners.add(listener);
  return () => {
    gameObjectChangeListeners.delete(listener);
  };
};

const notifyGameObjectChange = (type: string, gameObjectId?: string) => {
  gameObjectChangeListeners.forEach(listener => listener({ type, gameObjectId }));
};

// Setup GameObject change listener
export const setupGameObjectListener = () => {
  // Listen to all GameObject-related actions
  startAppListening({
    predicate: (action: any) => {
      return GAMEOBJECT_RELATED_ACTIONS.includes(action.type);
    },
    effect: (action: any, listenerApi) => {
      const state = listenerApi.getState() as any;
      const engineState = state.engine;

      let gameObjectId: string | undefined;

      // Extract gameObjectId from different action types
      if (action.type.startsWith('gameObjects/')) {
        // Direct GameObject actions
        gameObjectId = action.payload?.id;
      } else if (action.type.startsWith('components/')) {
        // Component actions - need to find which GameObject owns this component
        const componentId = action.payload?.id;
        if (componentId) {
          const component = engineState.components.byId[componentId];
          if (component) {
            // parentId on component is the GameObject ID
            gameObjectId = component.parentId;
          }
        }
      }

      // Notify all listeners
      notifyGameObjectChange(action.type, gameObjectId);
    }
  });
};

