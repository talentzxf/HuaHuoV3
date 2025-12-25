import { getEngineStore, deleteGameObject } from '@huahuo/engine';
import { store } from '../../../../store/store';
import { clearSelection } from '../../../../store/features/selection/selectionSlice';

/**
 * ObjectDeleteHandler
 * Handles deletion of selected objects (GameObjects, Layers, etc.)
 *
 * This is a centralized handler for delete operations that:
 * 1. Gets the selected object from Redux selection state
 * 2. Dispatches appropriate delete action to Redux Store
 * 3. Clears the selection
 * 4. ReduxAdapter will automatically handle removing Paper.js items
 */
export class ObjectDeleteHandler {
  /**
   * Delete the currently selected object
   * Returns true if something was deleted, false otherwise
   */
  public static deleteSelected(): boolean {
    const selectionState = store.getState().selection;

    // Check if something is selected
    if (!selectionState.selectedType || !selectionState.selectedId) {
      return false;
    }

    const selectedType = selectionState.selectedType;
    const selectedId = selectionState.selectedId;

    console.log('[ObjectDeleteHandler] Deleting:', selectedType, selectedId);

    switch (selectedType) {
      case 'gameObject':
        return this.deleteGameObject(selectedId);

      case 'layer':
        // TODO: Implement layer deletion if needed
        console.warn('[ObjectDeleteHandler] Layer deletion not implemented yet');
        return false;

      case 'vertex':
      case 'edge':
        // TODO: Implement vertex/edge deletion if needed
        console.warn('[ObjectDeleteHandler] Vertex/Edge deletion not implemented yet');
        return false;

      default:
        console.warn('[ObjectDeleteHandler] Unknown selected type:', selectedType);
        return false;
    }
  }

  /**
   * Delete a GameObject by ID
   */
  private static deleteGameObject(gameObjectId: string): boolean {
    try {
      // Delete GameObject from Redux Store
      const engineStore = getEngineStore();
      engineStore.dispatch(deleteGameObject(gameObjectId));

      // Clear selection
      store.dispatch(clearSelection());

      console.log('[ObjectDeleteHandler] GameObject deleted:', gameObjectId);
      return true;
    } catch (error) {
      console.error('[ObjectDeleteHandler] Failed to delete GameObject:', error);
      return false;
    }
  }

  /**
   * Check if delete operation is available (something is selected)
   */
  public static canDelete(): boolean {
    const selectionState = store.getState().selection;
    return !!(selectionState.selectedType && selectionState.selectedId);
  }

  /**
   * Get description of what will be deleted
   */
  public static getDeleteDescription(): string | null {
    const selectionState = store.getState().selection;

    if (!selectionState.selectedType || !selectionState.selectedId) {
      return null;
    }

    switch (selectionState.selectedType) {
      case 'gameObject':
        return `GameObject (${selectionState.selectedId})`;
      case 'layer':
        return `Layer (${selectionState.selectedId})`;
      case 'vertex':
        return `Vertex (${selectionState.selectedId})`;
      case 'edge':
        return `Edge (${selectionState.selectedId})`;
      default:
        return `Unknown (${selectionState.selectedType})`;
    }
  }
}

