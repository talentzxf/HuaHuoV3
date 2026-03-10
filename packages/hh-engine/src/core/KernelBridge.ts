/**
 * KernelBridge — singleton wrapper around the Rust/WASM KernelAPI.
 *
 * All data mutations go through here (dispatch commands).
 * All reads are either:
 *   a) Queried directly: kernel.query(...)
 *   b) Received via event subscription: kernel.subscribe_js(pattern, cb)
 *
 * This replaces EngineGlobals + all Redux engine slices.
 */

export type HhEventCategory =
  | 'project' | 'scene' | 'layer' | 'go' | 'component'
  | 'keyframe' | 'playback' | 'element';

export interface HhEvent {
  category: HhEventCategory;
  [key: string]: any;
}

export interface KernelCommandResult {
  ok: boolean;
  error: string;
  created_id: string;
  payload?: Uint8Array;
}

export interface KernelQueryResult {
  ok: boolean;
  error: string;
  data: any;
}

// Lazy-import WASM so non-WASM environments (tests, SSR) don't break
let _kernel: any = null;
let _initPromise: Promise<void> | null = null;

export class KernelBridge {
  private static instance: KernelBridge | null = null;

  private kernel: any = null;
  private _ready = false;

  private constructor() {}

  static getInstance(): KernelBridge {
    if (!KernelBridge.instance) {
      KernelBridge.instance = new KernelBridge();
    }
    return KernelBridge.instance;
  }

  /** Initialize WASM. Must be awaited before any other call. */
  async init(): Promise<void> {
    if (this._ready) return;
    if (_initPromise) { await _initPromise; return; }

    _initPromise = (async () => {
      // Dynamic import so webpack/vite can split the WASM bundle
      const wasmModule = await import('@huahuo/kernel-wasm');

      // wasm-bindgen outputs: export default async function init() + export class KernelAPI
      // The JS stub is CommonJS — webpack wraps it, giving various shapes depending on
      // how module.exports is structured.  Handle all cases:
      //   ESM real wasm-bindgen: wasmModule.default = init fn, wasmModule.KernelAPI = class
      //   CJS stub (module.exports = fn + .KernelAPI): wasmModule = fn with .KernelAPI prop
      const mod: any = wasmModule;

      // Locate init function
      const initFn: any = typeof mod.default === 'function'
        ? mod.default
        : typeof mod.init === 'function'
          ? mod.init
          : typeof mod === 'function'
            ? mod
            : null;
      if (initFn) await initFn();

      // Locate KernelAPI class
      const KernelAPIClass: any =
        mod.KernelAPI ??
        mod.default?.KernelAPI ??
        null;

      if (!KernelAPIClass) {
        throw new Error('[KernelBridge] Could not find KernelAPI in @huahuo/kernel-wasm');
      }

      _kernel = new KernelAPIClass();
      this.kernel = _kernel;
      this._ready = true;
    })();

    await _initPromise;
  }

  get ready(): boolean { return this._ready; }

  // ── Commands (mutate data in Rust) ────────────────────────────────────────

  dispatch(cmd: object): KernelCommandResult {
    this.assertReady();
    const raw = this.kernel.dispatch(JSON.stringify(cmd));
    return JSON.parse(raw) as KernelCommandResult;
  }

  // ── Queries (read data from Rust) ─────────────────────────────────────────

  query(q: object): KernelQueryResult {
    this.assertReady();
    const raw = this.kernel.query(JSON.stringify(q));
    const res = JSON.parse(raw);
    return {
      ok: res.ok,
      error: res.error ?? '',
      data: res.data ? (typeof res.data === 'string' ? JSON.parse(res.data) : res.data) : null,
    };
  }

  getProject(): any {
    return this.query({ GetProject: null }).data;
  }

  getCurrentScene(): any {
    const project = this.getProject();
    if (!project?.current_scene_id) return null;
    return this.query({ GetScene: { scene_id: project.current_scene_id } }).data;
  }

  getGameObject(id: string): any {
    return this.query({ GetGameObject: { game_object_id: id } }).data;
  }

  getInterpolatedProps(goId: string, frame: number): any {
    return this.query({ GetInterpolatedProps: { game_object_id: goId, frame } }).data;
  }

  getPlaybackState(): any {
    return this.query({ GetPlaybackState: null }).data;
  }

  getActiveGameObjects(sceneId: string, frame: number): string[] {
    return this.query({ GetActiveGameObjects: { scene_id: sceneId, frame } }).data ?? [];
  }

  // ── Convenience command helpers ───────────────────────────────────────────

  createProject(name: string, fps: number, width: number, height: number): string {
    const r = this.dispatch({ CreateProject: { name, fps, canvas_width: width, canvas_height: height } });
    if (!r.ok) throw new Error(`createProject failed: ${r.error}`);
    return r.created_id;
  }

  createScene(name: string, fps: number, duration: number): string {
    const r = this.dispatch({ CreateScene: { name, fps, duration } });
    if (!r.ok) throw new Error(`createScene failed: ${r.error}`);
    return r.created_id;
  }

  createLayer(sceneId: string, name: string): string {
    const r = this.dispatch({ CreateLayer: { scene_id: sceneId, name } });
    if (!r.ok) throw new Error(`createLayer failed: ${r.error}`);
    return r.created_id;
  }

  createGameObject(layerId: string, name: string, bornFrame: number = 0): string {
    const r = this.dispatch({ CreateGameObject: { layer_id: layerId, name, born_frame: bornFrame } });
    if (!r.ok) throw new Error(`createGameObject failed: ${r.error}`);
    return r.created_id;
  }

  deleteGameObject(id: string): void {
    this.dispatch({ DeleteGameObject: { game_object_id: id } });
  }

  setGameObjectActive(id: string, active: boolean): void {
    this.dispatch({ SetGameObjectActive: { game_object_id: id, active } });
  }

  setKeyframe(
    goId: string,
    componentType: string,
    propName: string,
    frame: number,
    value: any,
    easingType: string = 'linear'
  ): void {
    this.dispatch({
      SetKeyFrame: {
        game_object_id: goId,
        component_type: componentType,
        prop_name: propName,
        keyframe: { frame, value, easing: easingType },
      }
    });
  }

  removeKeyframe(goId: string, componentType: string, propName: string, frame: number): void {
    this.dispatch({
      RemoveKeyFrame: {
        game_object_id: goId,
        component_type: componentType,
        prop_name: propName,
        frame,
      }
    });
  }

  play(): void  { this.dispatch({ Play: null }); }
  pause(): void { this.dispatch({ Pause: null }); }
  stop(): void  { this.dispatch({ Stop: null }); }

  tick(deltaSeconds: number): number {
    this.assertReady();
    return this.kernel.tick(deltaSeconds);
  }

  setCurrentFrame(frame: number): void {
    this.dispatch({ SetCurrentFrame: { frame } });
  }

  // ── Persistence ───────────────────────────────────────────────────────────

  saveBytes(): Uint8Array {
    this.assertReady();
    return this.kernel.save_project_bytes();
  }

  loadBytes(data: Uint8Array): boolean {
    this.assertReady();
    return this.kernel.load_project_bytes(data);
  }

  // ── PubSub ────────────────────────────────────────────────────────────────

  /**
   * Subscribe to kernel events from JS.
   * Pattern examples: "*", "go/ball", "keyframe/{id}/Transform/position", "playback/frame_changed"
   * Returns a sub_id to pass to unsubscribe().
   */
  subscribe(pattern: string, callback: (event: HhEvent) => void): number {
    this.assertReady();
    return this.kernel.subscribe_js(pattern, (evJson: string) => {
      try { callback(JSON.parse(evJson)); }
      catch (e) { console.warn('[KernelBridge] Event parse error', e); }
    });
  }

  unsubscribe(subId: number): void {
    if (!this._ready) return;
    this.kernel.unsubscribe_js(subId);
  }

  /** Poll-style: drain all pending events. */
  takePendingEvents(): HhEvent[] {
    if (!this._ready) return [];
    const raw = this.kernel.take_pending_events_json();
    try { return JSON.parse(raw) as HhEvent[]; }
    catch { return []; }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private assertReady(): void {
    if (!this._ready || !this.kernel) {
      throw new Error('[KernelBridge] WASM not initialized. Call await KernelBridge.getInstance().init() first.');
    }
  }
}

/** Convenience singleton accessor */
export function getKernel(): KernelBridge {
  return KernelBridge.getInstance();
}

