import { store } from '../store/store';
import { SDK } from '@huahuo/sdk';

/**
 * SelectionAdapter
 * Listens to IDE's selection state changes and syncs them to Engine
 * This is the bridge between IDE layer and Engine layer
 */
export class SelectionAdapter {
  private previousSelectedId: string | null = null;
  private unsubscribe: (() => void) | null = null;

  /**
   * Start listening to selection changes in IDE store
   */
  startListening(): void {
    if (this.unsubscribe) {
      console.warn('[SelectionAdapter] Already listening');
      return;
    }

    // Initial state
    const currentState = store.getState();
    this.previousSelectedId = currentState.selection?.selectedGameObjectId || null;

    // Subscribe to store changes
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const currentSelectedId = state.selection?.selectedGameObjectId || null;

      // Only update if selection actually changed
      if (currentSelectedId !== this.previousSelectedId) {
        console.debug('[SelectionAdapter] Selection changed:', this.previousSelectedId, '->', currentSelectedId);

        // Call SDK to update Engine's selection state
        if (SDK.isInitialized()) {
          SDK.instance.selectGameObject(currentSelectedId);
        }

        this.previousSelectedId = currentSelectedId;
      }
    });

    console.debug('[SelectionAdapter] Started listening to selection changes');
  }

  /**
   * Stop listening to selection changes
   */
  stopListening(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

// Singleton instance
let selectionAdapterInstance: SelectionAdapter | null = null;

/**
 * Get or create the SelectionAdapter singleton
 */
export function getSelectionAdapter(): SelectionAdapter {
  if (!selectionAdapterInstance) {
    selectionAdapterInstance = new SelectionAdapter();
  }
  return selectionAdapterInstance;
}

