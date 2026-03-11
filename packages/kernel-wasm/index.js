/**
 * @huahuo/kernel-wasm — JavaScript stub
 *
 * This is a pure-JS implementation of the KernelAPI interface that wasm-bindgen
 * would normally generate from the Rust crate.  It stores everything in-memory
 * and emits the same events as the Rust kernel would so the IDE works end-to-end
 * without a compiled WASM binary.
 *
 * Replace this file with the wasm-pack output once the Rust kernel is ready.
 */

'use strict';

// ─── Tiny ID generator ────────────────────────────────────────────────────────
let _idCounter = 0;
function newId(prefix) {
  return `${prefix}_${(++_idCounter).toString(36)}_${Date.now().toString(36)}`;
}

// ─── In-memory store ─────────────────────────────────────────────────────────
let _state = {
  project: null,
  scenes: {},
  layers: {},
  gameObjects: {},
  components: {},
  playback: { current_frame: 0, is_playing: false, fps: 30 },
};

// ─── PubSub ───────────────────────────────────────────────────────────────────
let _subs = {};
let _subIdCounter = 0;

function _publish(topic, payload) {
  console.debug('[kernel-stub] publish:', topic, JSON.stringify(payload).slice(0, 80));
  for (const [, sub] of Object.entries(_subs)) {
    const pattern = sub.pattern;
    // Simple wildcard matching: "*" matches everything, segments with "*" match any
    const patParts = pattern.split('/');
    const topParts = topic.split('/');
    let match = patParts.length === 1 && patParts[0] === '*';
    if (!match && patParts.length === topParts.length) {
      match = patParts.every((p, i) => p === '*' || p === topParts[i]);
    }
    if (!match && pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      match = topic.startsWith(prefix);
    }
    // Prefix match: "keyframe" matches "keyframe/goId/Transform/position"
    if (!match && topParts[0] === pattern) match = true;
    if (match) {
      try { sub.cb(JSON.stringify({ topic, ...payload })); }
      catch (e) { console.warn('[kernel-wasm stub] subscriber error', e); }
    }
  }
}

// ─── Easing interpolation ────────────────────────────────────────────────────
function _lerp(a, b, t) {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (typeof a === 'object' && a !== null) {
    const r = {};
    for (const k of Object.keys(a)) r[k] = _lerp(a[k], b[k], t);
    return r;
  }
  return t < 0.5 ? a : b;
}

function _easeT(t, easing) {
  switch (easing) {
    case 'ease_in':    return t * t;
    case 'ease_out':   return 1 - (1 - t) * (1 - t);
    case 'ease_in_out': return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    default: return t; // linear
  }
}

function _interpolateProp(keyframes, frame) {
  if (!keyframes || keyframes.length === 0) return undefined;
  if (frame <= keyframes[0].frame) return keyframes[0].value;
  if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1].value;
  for (let i = 0; i < keyframes.length - 1; i++) {
    const kf0 = keyframes[i], kf1 = keyframes[i + 1];
    if (frame >= kf0.frame && frame <= kf1.frame) {
      const span = kf1.frame - kf0.frame;
      const raw = span === 0 ? 1 : (frame - kf0.frame) / span;
      const t = _easeT(raw, kf1.easing || 'linear');
      return _lerp(kf0.value, kf1.value, t);
    }
  }
  return keyframes[keyframes.length - 1].value;
}

// ─── Command dispatch ─────────────────────────────────────────────────────────
function _dispatch(cmdJson) {
  const cmd = JSON.parse(cmdJson);
  const key = Object.keys(cmd)[0];
  const args = cmd[key] || {};
  const result = { ok: true, error: '', created_id: '' };

  try {
    switch (key) {
      case 'CreateProject': {
        const id = newId('proj');
        _state.project = {
          id, name: args.name, fps: args.fps,
          canvas_width: args.canvas_width, canvas_height: args.canvas_height,
          total_frames: args.fps * 5,
          animation_end_frame: null,
          current_scene_id: null,
        };
        result.created_id = id;
        _publish('project', { action: 'created', id });
        break;
      }
      case 'CreateScene': {
        const id = newId('scene');
        _state.scenes[id] = { id, name: args.name, fps: args.fps, duration: args.duration, layer_ids: [], layers: {} };
        if (_state.project) _state.project.current_scene_id = id;
        result.created_id = id;
        _publish('scene', { action: 'created', id });
        break;
      }
      case 'CreateLayer': {
        const id = newId('layer');
        _state.layers[id] = {
          id, name: args.name,
          scene_id: args.scene_id,
          game_object_ids: [],
          visible: true, locked: false, has_timeline: true,
          clips: [], key_frames: [],
        };
        const scene = _state.scenes[args.scene_id];
        if (scene) {
          scene.layer_ids.push(id);
          scene.layers[id] = _state.layers[id];
        }
        result.created_id = id;
        _publish('layer', { action: 'created', id });
        break;
      }
      case 'CreateGameObject': {
        const id = newId('go');
        _state.gameObjects[id] = {
          id, name: args.name,
          layer_id: args.layer_id,
          born_frame: args.born_frame ?? 0,
          active: true,
          components: {},
        };
        const layer = _state.layers[args.layer_id];
        if (layer) layer.game_object_ids.push(id);
        result.created_id = id;
        _publish('go', { action: 'created', id });
        break;
      }
      case 'DeleteGameObject': {
        const go = _state.gameObjects[args.game_object_id];
        if (go) {
          const layer = _state.layers[go.layer_id];
          if (layer) layer.game_object_ids = layer.game_object_ids.filter(gid => gid !== args.game_object_id);
          delete _state.gameObjects[args.game_object_id];
        }
        _publish('go', { action: 'deleted', id: args.game_object_id });
        break;
      }
      case 'SetGameObjectActive': {
        const go = _state.gameObjects[args.game_object_id];
        if (go) go.active = args.active;
        _publish(`go/${args.game_object_id}`, { action: 'active_changed', active: args.active });
        break;
      }
      case 'SetKeyFrame': {
        const { game_object_id, component_type, prop_name, keyframe } = args;
        const go = _state.gameObjects[game_object_id];
        if (!go) { result.ok = false; result.error = `GO ${game_object_id} not found`; break; }
        if (!go.components[component_type]) go.components[component_type] = { keyFrames: {} };
        const comp = go.components[component_type];
        if (!comp.keyFrames[prop_name]) comp.keyFrames[prop_name] = [];
        const kfs = comp.keyFrames[prop_name];
        const existing = kfs.findIndex(k => k.frame === keyframe.frame);
        if (existing >= 0) {
          if (keyframe.value !== undefined) kfs[existing].value = keyframe.value;
          if (keyframe.easing !== undefined) kfs[existing].easing = keyframe.easing;
        } else {
          kfs.push({ frame: keyframe.frame, value: keyframe.value, easing: keyframe.easing || 'linear' });
          kfs.sort((a, b) => a.frame - b.frame);
        }
        // Publish with go_id so KernelAdapter can re-interpolate this GO
        _publish(`keyframe/${game_object_id}/${component_type}/${prop_name}`, {
          action: 'set', frame: keyframe.frame,
          go_id: game_object_id, component_type, prop_name
        });
        _publish('keyframe', {
          action: 'set', go_id: game_object_id, component_type, prop_name
        });
        break;
      }
      case 'Play': {
        _state.playback.is_playing = true;
        _publish('playback/started', {});
        break;
      }
      case 'Pause': {
        _state.playback.is_playing = false;
        _publish('playback/paused', {});
        break;
      }
      case 'Stop': {
        _state.playback.is_playing = false;
        _state.playback.current_frame = 0;
        _publish('playback/stopped', { frame: 0 });
        break;
      }
      case 'SetCurrentFrame': {
        _state.playback.current_frame = args.frame;
        _publish('playback/frame_changed', { frame: args.frame });
        break;
      }
      case 'Tick': {
        if (!_state.playback.is_playing) break;
        const fps = _state.project?.fps ?? 30;
        const totalFrames = _state.project?.total_frames ?? 120;
        const endFrame = _state.project?.animation_end_frame ?? (totalFrames - 1);
        _state.playback.current_frame += 1;
        if (_state.playback.current_frame > endFrame) {
          _state.playback.current_frame = 0;
          _publish('playback/looped_back', { frame: 0 });
        } else {
          _publish('playback/frame_changed', { frame: _state.playback.current_frame });
        }
        break;
      }
      default:
        result.ok = false;
        result.error = `Unknown command: ${key}`;
    }
  } catch (e) {
    result.ok = false;
    result.error = String(e);
  }
  return JSON.stringify(result);
}

// ─── Query ────────────────────────────────────────────────────────────────────
function _query(queryJson) {
  const q = JSON.parse(queryJson);
  const key = Object.keys(q)[0];
  const args = q[key] || {};
  const result = { ok: true, error: '', data: null };

  try {
    switch (key) {
      case 'GetProject':
        result.data = _state.project;
        break;
      case 'GetScene':
        result.data = _state.scenes[args.scene_id] ?? null;
        break;
      case 'GetCurrentScene': {
        const sid = _state.project?.current_scene_id;
        if (!sid || !_state.scenes[sid]) { result.data = null; break; }
        const scene = _state.scenes[sid];
        // Build a game_objects map from all GOs belonging to this scene's layers
        const gameObjects = {};
        for (const layerId of scene.layer_ids ?? []) {
          const layer = _state.layers[layerId];
          if (!layer) continue;
          for (const goId of layer.game_object_ids ?? []) {
            const go = _state.gameObjects[goId];
            if (go) gameObjects[goId] = { ...go, born_frame_id: go.born_frame };
          }
        }
        result.data = { ...scene, game_objects: gameObjects };
        break;
      }
      case 'GetGameObject':
        result.data = _state.gameObjects[args.game_object_id] ?? null;
        break;
      case 'GetPlaybackState':
        result.data = { ..._state.playback };
        break;
      case 'GetInterpolatedProps': {
        const go = _state.gameObjects[args.game_object_id];
        if (!go) { result.data = null; break; }
        const frame = args.frame ?? _state.playback.current_frame;
        const props = {};
        for (const [compType, comp] of Object.entries(go.components)) {
          props[compType] = {};
          for (const [propName, kfs] of Object.entries(comp.keyFrames)) {
            props[compType][propName] = _interpolateProp(kfs, frame);
          }
        }
        result.data = props;
        break;
      }
      case 'GetActiveGameObjects': {
        const scene = _state.scenes[args.scene_id];
        if (!scene) { result.data = []; break; }
        const frame = args.frame ?? _state.playback.current_frame;
        const active = [];
        for (const layerId of scene.layer_ids) {
          const layer = _state.layers[layerId];
          if (!layer) continue;
          for (const goId of layer.game_object_ids) {
            const go = _state.gameObjects[goId];
            if (go && go.active && frame >= go.born_frame) active.push(goId);
          }
        }
        result.data = active;
        break;
      }
      default:
        result.ok = false;
        result.error = `Unknown query: ${key}`;
    }
  } catch (e) {
    result.ok = false;
    result.error = String(e);
  }
  return JSON.stringify(result);
}

// ─── KernelAPI class (mirrors wasm-bindgen output) ────────────────────────────
class KernelAPI {
  // Primary methods used by KernelBridge (without _json suffix)
  dispatch(cmdJson) {
    return _dispatch(cmdJson);
  }

  query(queryJson) {
    return _query(queryJson);
  }

  // Also expose with _json suffix for any legacy callers
  dispatch_json(cmdJson) {
    return _dispatch(cmdJson);
  }

  query_json(queryJson) {
    return _query(queryJson);
  }

  subscribe_js(pattern, callback) {
    const id = ++_subIdCounter;
    _subs[id] = { pattern, cb: callback };
    return id;
  }

  unsubscribe_js(subId) {
    delete _subs[subId];
  }

  take_pending_events_json() {
    return '[]';
  }

  tick(deltaSeconds) {
    // Drive the playback forward by deltaSeconds
    if (!_state.playback.is_playing) return 0;
    const fps = _state.project?.fps ?? 30;
    const totalFrames = _state.project?.total_frames ?? 120;
    const endFrame = _state.project?.animation_end_frame ?? (totalFrames - 1);

    // Accumulate fractional frames
    if (!this._frameAccum) this._frameAccum = 0;
    this._frameAccum += deltaSeconds * fps;

    let advanced = 0;
    while (this._frameAccum >= 1) {
      this._frameAccum -= 1;
      advanced++;
      _state.playback.current_frame += 1;
      if (_state.playback.current_frame > endFrame) {
        _state.playback.current_frame = 0;
        _publish('playback/looped_back', { frame: 0 });
      } else {
        _publish('playback/frame_changed', { frame: _state.playback.current_frame });
      }
    }
    return advanced;
  }

  save_project_bytes() {
    const json = JSON.stringify(_state);
    const enc = new TextEncoder();
    return enc.encode(json);
  }

  load_project_bytes(data) {
    try {
      const dec = new TextDecoder();
      _state = JSON.parse(dec.decode(data));
      _publish('project', { action: 'loaded' });
      return true;
    } catch {
      return false;
    }
  }
}

// ─── wasm-bindgen init shim ───────────────────────────────────────────────────
// wasm-bindgen normally exports `export default async function init() {...}`
// We just resolve immediately since there's no WASM to load.
async function init() { /* no-op for stub */ }

// Export in a way webpack's dynamic import() will expose correctly:
//   import('@huahuo/kernel-wasm').then(m => m.default() / m.KernelAPI)
module.exports = init;
module.exports.__esModule = true;
module.exports.default = init;
module.exports.KernelAPI = KernelAPI;
module.exports.init = init;

