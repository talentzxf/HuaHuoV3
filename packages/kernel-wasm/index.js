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

// ─── Animation end frame tracker ──────────────────────────────────────────────
// Extends animation_end_frame to `frame` if it is beyond the current value.
// Publishes a 'project' event so the timeline END marker updates automatically.
function _maybeExtendAnimationEnd(frame) {
  if (!_state.project) return;
  const currentEnd = _state.project.animation_end_frame ?? -1;
  if (frame > currentEnd) {
    _state.project.animation_end_frame = frame;
    _publish('project', { action: 'animation_end_updated', animation_end_frame: frame });
  }
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
          animation_end_frame: 0,   // default: last frame = frame 0 (grows as keyframes are added)
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
        const isNewFrame = existing < 0;
        if (existing >= 0) {
          if (keyframe.value !== undefined) kfs[existing].value = keyframe.value;
          if (keyframe.easing !== undefined) kfs[existing].easing = keyframe.easing;
        } else {
          kfs.push({ frame: keyframe.frame, value: keyframe.value, easing: keyframe.easing || 'linear' });
          kfs.sort((a, b) => a.frame - b.frame);
        }
        // Also aggregate this frame onto the layer's key_frames list (used by Timeline UI)
        const layer = _state.layers[go.layer_id];
        if (layer && isNewFrame) {
          if (!layer.key_frames) layer.key_frames = [];
          if (!layer.key_frames.includes(keyframe.frame)) {
            layer.key_frames.push(keyframe.frame);
            layer.key_frames.sort((a, b) => a - b);
          }
          // Keep scene.layers in sync
          const scene = Object.values(_state.scenes).find(s => s.layer_ids && s.layer_ids.includes(go.layer_id));
          if (scene && scene.layers && scene.layers[go.layer_id]) {
            scene.layers[go.layer_id].key_frames = layer.key_frames;
          }
        }
        // is_new_frame lets subscribers skip full rebuilds when only a value changed
        _publish(`keyframe/${game_object_id}/${component_type}/${prop_name}`, {
          action: 'set', frame: keyframe.frame,
          go_id: game_object_id, component_type, prop_name,
          is_new_frame: isNewFrame,
        });
        _publish('keyframe', {
          action: 'set', go_id: game_object_id, component_type, prop_name,
          is_new_frame: isNewFrame,
        });
        // Grow animation_end_frame to cover this keyframe's position.
        _maybeExtendAnimationEnd(keyframe.frame);
        break;
      }
      // ── MergeFrameSpan ──────────────────────────────────────────────────────
      // Layer-level operation: collapse [start_frame, end_frame] into a single
      // FrameSpan (clip).  No GameObject required.  Any existing clips that
      // overlap the requested range are absorbed into the new span.
      case 'MergeFrameSpan': {
        const { layer_id, start_frame, end_frame } = args;
        const mergeLayer = _state.layers[layer_id];
        if (!mergeLayer) { result.ok = false; result.error = `Layer ${layer_id} not found`; break; }

        if (!mergeLayer.clips) mergeLayer.clips = [];

        // Compute the union of the requested span with any overlapping clips.
        let mergedStart = start_frame;
        let mergedEnd   = end_frame;
        const overlapping = mergeLayer.clips.filter(c => {
          const cEnd = c.startFrame + c.length - 1;
          return !(cEnd < start_frame || c.startFrame > end_frame);
        });
        for (const c of overlapping) {
          mergedStart = Math.min(mergedStart, c.startFrame);
          mergedEnd   = Math.max(mergedEnd, c.startFrame + c.length - 1);
        }

        // Remove all overlapping clips, then add the merged one.
        mergeLayer.clips = mergeLayer.clips.filter(c => {
          const cEnd = c.startFrame + c.length - 1;
          return cEnd < start_frame || c.startFrame > end_frame;
        });
        mergeLayer.clips.push({ id: newId('clip'), startFrame: mergedStart, length: mergedEnd - mergedStart + 1 });
        mergeLayer.clips.sort((a, b) => a.startFrame - b.startFrame);

        // ── Do NOT touch key_frames here ──────────────────────────────────
        // key_frames[] stores the frame numbers of actual keyframes on GOs in
        // this layer (populated by SetKeyFrame, cleared by RemoveKeyFrame).
        // Clip spans (clips[]) are a separate concept — merging a span must
        // never erase keyframe markers.

        // Keep scene.layers in sync (clips only).
        const mergeScene = Object.values(_state.scenes).find(
          s => s.layer_ids && s.layer_ids.includes(layer_id)
        );
        if (mergeScene && mergeScene.layers && mergeScene.layers[layer_id]) {
          mergeScene.layers[layer_id].clips = mergeLayer.clips;
        }

        _publish('layer', { action: 'merged', layer_id, start_frame: mergedStart, end_frame: mergedEnd });
        // Grow animation_end_frame to cover the merged span.
        _maybeExtendAnimationEnd(mergedEnd);
        break;
      }

      // ── MergeKeyFrames (legacy) ──────────────────────────────────────────────
      // Kept for backward-compat.  Averages keyframe values inside a range for a
      // specific GO/component/prop, then delegates the FrameSpan creation to the
      // MergeFrameSpan logic above.  A missing GO is no longer a fatal error —
      // the FrameSpan is still created on the layer.
      case 'MergeKeyFrames': {
        const { game_object_id, component_type, prop_name, start_frame, end_frame, strategy } = args;
        const go = _state.gameObjects[game_object_id];

        // Track which frame numbers were removed from this GO's component keyframes.
        const removedFrames = new Set();

        // Optional: average keyframe values when the GO exists.
        if (go) {
          const comp = go.components?.[component_type];
          if (comp && comp.keyFrames && comp.keyFrames[prop_name]) {
            const kfs = comp.keyFrames[prop_name];
            const inRange = kfs.filter(k => k.frame >= start_frame && k.frame <= end_frame);
            if (inRange.length > 0) {
              const avg = (vals) => {
                if (!vals.length) return undefined;
                const first = vals[0];
                if (typeof first === 'number') return vals.reduce((s, v) => s + v, 0) / vals.length;
                if (first && typeof first === 'object') {
                  const keys = Object.keys(first);
                  const out = {};
                  keys.forEach(k => {
                    const nums = vals.map(v => (v && typeof v[k] === 'number') ? v[k] : 0);
                    out[k] = nums.reduce((s, v) => s + v, 0) / nums.length;
                  });
                  return out;
                }
                return first;
              };
              const mergedValue = avg(inRange.map(k => k.value));
              // Record frames being removed (excluding start_frame which gets the merged value)
              inRange.forEach(k => { if (k.frame !== start_frame) removedFrames.add(k.frame); });
              comp.keyFrames[prop_name] = kfs.filter(k => k.frame < start_frame || k.frame > end_frame);
              comp.keyFrames[prop_name].push({ frame: start_frame, value: mergedValue, easing: 'linear' });
              comp.keyFrames[prop_name].sort((a, b) => a.frame - b.frame);
            }
          }

          // ── Sync layer.key_frames after removing component keyframes ──────────
          // For each removed frame, check if any other GO/component/prop in the
          // layer still has a keyframe at that frame.  If not, prune it from
          // layer.key_frames so the timeline doesn't show a stale marker.
          const layer = _state.layers[go.layer_id];
          if (layer && layer.key_frames && removedFrames.size > 0) {
            removedFrames.forEach(f => {
              // Is there any remaining keyframe at frame f across all GOs in this layer?
              const stillHasKf = (layer.game_object_ids ?? []).some(gid => {
                const g = _state.gameObjects[gid];
                if (!g) return false;
                return Object.values(g.components ?? {}).some(gc => {
                  return Object.values(gc.keyFrames ?? {}).some(kfArr =>
                    Array.isArray(kfArr) && kfArr.some(k => k.frame === f)
                  );
                });
              });
              if (!stillHasKf) {
                layer.key_frames = layer.key_frames.filter(kf => kf !== f);
              }
            });
          }
        }

        // Delegate FrameSpan creation to MergeFrameSpan (works even without a GO).
        const layerId = go ? go.layer_id : args.layer_id;
        if (layerId) {
          // Re-use the MergeFrameSpan logic by dispatching internally.
          const spanCmd = JSON.stringify({ MergeFrameSpan: { layer_id: layerId, start_frame, end_frame } });
          _dispatch(spanCmd);
        }
        break;
      }

      // ── RemoveKeyFrame ────────────────────────────────────────────────────────
      // Remove a single keyframe from a GO component property.
      // Also cleans up layer.key_frames if no other GO has a keyframe at that frame.
      case 'RemoveKeyFrame': {
        const { game_object_id, component_type, prop_name, frame: removeFrame } = args;
        const go = _state.gameObjects[game_object_id];
        if (!go) { result.ok = false; result.error = `GO ${game_object_id} not found`; break; }
        const comp = go.components?.[component_type];
        if (comp && comp.keyFrames && comp.keyFrames[prop_name]) {
          const before = comp.keyFrames[prop_name].length;
          comp.keyFrames[prop_name] = comp.keyFrames[prop_name].filter(k => k.frame !== removeFrame);
          const removed = comp.keyFrames[prop_name].length < before;

          if (removed) {
            // Prune layer.key_frames if no other GO/component/prop still uses this frame.
            const layer = _state.layers[go.layer_id];
            if (layer && layer.key_frames) {
              const stillHasKf = (layer.game_object_ids ?? []).some(gid => {
                const g = _state.gameObjects[gid];
                if (!g) return false;
                return Object.values(g.components ?? {}).some(c => {
                  return Object.values(c.keyFrames ?? {}).some(kfArr =>
                    Array.isArray(kfArr) && kfArr.some(k => k.frame === removeFrame)
                  );
                });
              });
              if (!stillHasKf) {
                layer.key_frames = layer.key_frames.filter(kf => kf !== removeFrame);
                // Keep scene.layers in sync
                const rScene = Object.values(_state.scenes).find(s => s.layer_ids && s.layer_ids.includes(go.layer_id));
                if (rScene && rScene.layers && rScene.layers[go.layer_id]) {
                  rScene.layers[go.layer_id].key_frames = layer.key_frames;
                }
              }
            }
            _publish(`keyframe/${game_object_id}/${component_type}/${prop_name}`, {
              action: 'removed', frame: removeFrame, go_id: game_object_id, component_type, prop_name,
            });
            _publish('keyframe', { action: 'removed', go_id: game_object_id, component_type, prop_name });
          }
        }
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
        // Wrap at animation_end_frame (defaults to 0 until content is added)
        const endFrame = _state.project?.animation_end_frame ?? 0;
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
          const clips = layer.clips ?? [];
          for (const goId of layer.game_object_ids) {
            const go = _state.gameObjects[goId];
            // Must be active and born by this frame.
            if (!go || !go.active || frame < (go.born_frame ?? go.born_frame_id ?? 0)) continue;
            // Lifecycle rule: if the layer has clips, each GO is only active
            // within the specific clip that covers its born_frame.
            // This prevents GOs from "bleeding" into sibling clips.
            if (clips.length > 0) {
              const bornFrame = go.born_frame ?? go.born_frame_id ?? 0;
              // Find the clip that "owns" this GO — the one whose range includes its born_frame.
              const bornClip = clips.find(c => {
                const cEnd = c.startFrame + c.length - 1;
                return bornFrame >= c.startFrame && bornFrame <= cEnd;
              });
              // GO has no associated clip → not visible.
              if (!bornClip) continue;
              // GO is only visible within its own born-clip's range.
              const clipEnd = bornClip.startFrame + bornClip.length - 1;
              if (frame < bornClip.startFrame || frame > clipEnd) continue;
            }
            active.push(goId);
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
    // Wrap at animation_end_frame (defaults to 0 until content is added)
    const endFrame = _state.project?.animation_end_frame ?? 0;

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

// Expose internal API on window for E2E tests (browser env only).
// This lives in the stub itself so it's always available regardless of
// which app code is running — no App.tsx change, no webpack rebuild needed.
if (typeof window !== 'undefined') {
  window.__kernel_stub__ = {
    dispatch: (cmd) => JSON.parse(_dispatch(JSON.stringify(cmd))),
    query:    (q)   => JSON.parse(_query(JSON.stringify(q))),
    getState: ()    => _state,
  };
}

// Export in a way webpack's dynamic import() will expose correctly:
//   import('@huahuo/kernel-wasm').then(m => m.default() / m.KernelAPI)
module.exports = init;
module.exports.__esModule = true;
module.exports.default = init;
module.exports.KernelAPI = KernelAPI;
module.exports.init = init;

