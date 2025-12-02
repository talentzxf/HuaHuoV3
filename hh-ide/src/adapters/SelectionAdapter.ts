import { store } from '../store/store';
import { SDK } from '@huahuo/sdk';

/**
 * SelectionAdapter
 * Listens to IDE's selection state changes and syncs them to Engine
 * This is the bridge between IDE layer and Engine layer
 */
export class SelectionAdapter {
  private previousSelectedType: string | null = null;
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
    this.previousSelectedType = currentState.selection?.selectedType || null;
    this.previousSelectedId = currentState.selection?.selectedId || null;

    // Subscribe to store changes
    this.unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const currentSelectedType = state.selection?.selectedType || null;
      const currentSelectedId = state.selection?.selectedId || null;

      // Only update if selection actually changed
      if (currentSelectedId !== this.previousSelectedId || currentSelectedType !== this.previousSelectedType) {
        console.debug('[SelectionAdapter] Selection changed:',
          { type: this.previousSelectedType, id: this.previousSelectedId },
          '->',
          { type: currentSelectedType, id: currentSelectedId }
        );

        // Call SDK to update Engine's selection state (only for gameObject type)
        if (SDK.isInitialized() && currentSelectedType === 'gameObject') {
          SDK.instance.selectGameObject(currentSelectedId);
        }

        this.previousSelectedType = currentSelectedType;
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

