// Composite actions that coordinate multiple reducers
import { updateComponentProps } from './ComponentSlice';
import { addKeyFrame } from './LayerSlice';

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
 */
export const updateComponentPropsWithKeyFrame = (payload: {
    id: string;
    patch: Record<string, any>;
}) => {
    return (dispatch: any, getState: any) => {
        const { id, patch } = payload;

        // Update component props
        dispatch(updateComponentProps({ id, patch }));

        // Automatically add keyframe
        const state = getState();
        const engineState = state.engine || state;

        const component = engineState.components.byId[id];
        if (!component) return;

        const layerId = findLayerForGameObject(component.parentId, engineState);
        if (layerId) {
            const currentFrame = engineState.playback.currentFrame;
            dispatch(addKeyFrame({
                layerId,
                frame: currentFrame,
                gameObjectId: component.parentId
            }));
        }
    };
};

