import type { Store } from '@reduxjs/toolkit';
import type { EngineState } from '../store/store';

// Global store reference and selector for Engine internals to access
let globalStore: Store | null = null;
let engineStateSelector: ((state: any) => EngineState) | null = null;

/**
 * Initialize the global engine store
 * Called by Engine constructor
 */
export function initEngineStore(store: Store, selector: (state: any) => EngineState): void {
  globalStore = store;
  engineStateSelector = selector;
}

/**
 * Get the global engine store
 */
export function getEngineStore(): Store {
  if (!globalStore) {
    throw new Error('Engine store not initialized. Make sure Engine is constructed with a store.');
  }
  return globalStore;
}

/**
 * Get the current engine state
 */
export function getEngineState(): EngineState {
  if (!globalStore || !engineStateSelector) {
    throw new Error('Engine not initialized properly.');
  }
  return engineStateSelector(globalStore.getState());
}

