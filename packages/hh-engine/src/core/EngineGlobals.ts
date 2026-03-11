/**
 * EngineGlobals — legacy compatibility shim.
 *
 * Previously stored a Redux Store reference. Now delegates to KernelBridge.
 * Kept so existing call-sites that import getEngineStore / getEngineState
 * continue to compile during migration.
 *
 * TODO: After full migration, replace call-sites and delete this file.
 */
import { KernelBridge } from './KernelBridge';

/** @deprecated Use getKernel() from KernelBridge instead */
export function initEngineStore(_store: any, _selector?: any): void {
  // No-op: KernelBridge is initialized via KernelBridge.getInstance().init()
  console.warn('[EngineGlobals] initEngineStore is deprecated. Use KernelBridge.getInstance().init()');
}

/** @deprecated Use getKernel() from KernelBridge instead */
export function getEngineStore(): any {
  // Return a minimal compatibility shim
  const kernel = KernelBridge.getInstance();
  return {
    dispatch: (action: any) => {
      console.warn('[EngineGlobals] getEngineStore().dispatch() is deprecated. Use getKernel() directly.', action);
    },
    getState: () => {
      return { engine: kernel.ready ? kernel.getProject() : {} };
    },
  };
}

/** @deprecated Use getKernel().getProject() etc. instead */
export function getEngineState(): any {
  const kernel = KernelBridge.getInstance();
  if (!kernel.ready) {
    throw new Error('[EngineGlobals] Kernel not initialized. Call await KernelBridge.getInstance().init() first.');
  }
  // Return a shape compatible with old EngineState for gradual migration
  const pb = kernel.getPlaybackState();
  return {
    playback: {
      currentFrame: pb?.current_frame ?? 0,
      isPlaying: pb?.is_playing ?? false,
      fps: pb?.fps ?? 30,
    },
    // Stubs for slices that no longer exist
    gameObjects: { byId: {} },
    components:  { byId: {} },
    layers:      { byId: {} },
    scenes:      { byId: {}, currentSceneId: null },
    project:     { current: kernel.getProject() },
  };
}

