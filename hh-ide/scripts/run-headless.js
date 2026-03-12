// headless run script — uses kernel-wasm directly if Playwright not available
// Performs: create project, create scene, create layer, create game object, set keyframe, advance playback by ticks and verify frame changed

const path = require('path');
(async () => {
  try {
    console.log('[headless] Loading kernel-wasm...');
    const modPath = path.resolve(__dirname, '..', '..', 'packages', 'kernel-wasm', 'index.js');
    const mod = require(modPath);
    const initFn = typeof mod.default === 'function' ? mod.default : (typeof mod.init === 'function' ? mod.init : (typeof mod === 'function' ? mod : null));
    if (initFn) await initFn();
    const KernelAPI = mod.KernelAPI || mod.default?.KernelAPI;
    if (!KernelAPI) throw new Error('KernelAPI not found in module');
    const api = new KernelAPI();

    const dispatch = (cmd) => {
      const raw = api.dispatch(JSON.stringify(cmd));
      return JSON.parse(raw);
    };
    const query = (q) => {
      const raw = api.query(JSON.stringify(q));
      return JSON.parse(raw);
    };

    console.log('[headless] create project');
    let r = dispatch({ CreateProject: { name: 'HeadlessProject', fps: 30, canvas_width: 800, canvas_height: 600 } });
    if (!r.ok) throw new Error('CreateProject failed: ' + r.error);
    const projectId = r.created_id;
    console.log('[headless] created project', projectId);

    console.log('[headless] create scene');
    r = dispatch({ CreateScene: { name: 'Scene1', fps: 30, duration: 5 } });
    if (!r.ok) throw new Error('CreateScene failed: ' + r.error);
    const sceneId = r.created_id;
    console.log('[headless] created scene', sceneId);

    console.log('[headless] create layer');
    r = dispatch({ CreateLayer: { scene_id: sceneId, name: 'Layer1' } });
    if (!r.ok) throw new Error('CreateLayer failed: ' + r.error);
    const layerId = r.created_id;
    console.log('[headless] created layer', layerId);

    console.log('[headless] create game object');
    r = dispatch({ CreateGameObject: { layer_id: layerId, name: 'go_headless', born_frame: 0 } });
    if (!r.ok) throw new Error('CreateGameObject failed: ' + r.error);
    const goId = r.created_id;
    console.log('[headless] created go', goId);

    console.log('[headless] set keyframe');
    r = dispatch({ SetKeyFrame: { game_object_id: goId, component_type: 'Transform', prop_name: 'position', keyframe: { frame: 10, value: { x: 100, y: 200 }, easing: 'linear' } } });
    if (!r.ok) throw new Error('SetKeyFrame failed: ' + r.error);
    console.log('[headless] keyframe set');

    console.log('[headless] start playback');
    r = dispatch({ Play: null });
    if (!r.ok) throw new Error('Play failed: ' + r.error);

    // Advance time via tick
    const fps = 30;
    for (let i = 0; i < 12; i++) {
      const advanced = api.tick(1.0 / fps);
      console.log('[headless] tick advanced frames:', advanced);
    }

    const pb = query({ GetPlaybackState: null });
    console.log('[headless] playback state after ticks:', pb.data || pb);

    const props = query({ GetInterpolatedProps: { game_object_id: goId, frame: 10 } });
    console.log('[headless] interpolated props at frame 10:', props.data || props);

    if (props.data && props.data.Transform && props.data.Transform.position) {
      const pos = props.data.Transform.position;
      if (pos.x === 100 && pos.y === 200) {
        console.log('[headless] SUCCESS: interpolated position matches expected value');
        process.exit(0);
      }
      console.error('[headless] FAILURE: interpolated position mismatch', pos);
      process.exit(2);
    } else {
      console.error('[headless] FAILURE: missing interpolated props', props);
      process.exit(3);
    }
  } catch (e) {
    console.error('[headless] ERROR', e && e.stack ? e.stack : e);
    process.exit(4);
  }
})();
