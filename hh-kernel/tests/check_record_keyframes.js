const path = require('path');
(async ()=>{
  try{
    const modPath = path.resolve(__dirname,'..','..','packages','kernel-wasm','index.js');
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
    const query = (q) => JSON.parse(api.query(JSON.stringify(q)));

    console.log('Creating project...');
    let r = dispatch({ CreateProject: { name: 'test', fps: 30, canvas_width: 800, canvas_height: 600 } });
    if (!r.ok) throw new Error('CreateProject failed: '+r.error);
    const projectId = r.created_id;

    console.log('Creating scene...');
    r = dispatch({ CreateScene: { name: 's', fps: 30, duration: 5 } });
    if (!r.ok) throw new Error('CreateScene failed: '+r.error);
    const sceneId = r.created_id;

    console.log('Creating layer...');
    r = dispatch({ CreateLayer: { scene_id: sceneId, name: 'layer1' } });
    if (!r.ok) throw new Error('CreateLayer failed: '+r.error);
    const layerId = r.created_id;

    console.log('Creating game object...');
    r = dispatch({ CreateGameObject: { layer_id: layerId, name: 'go1', born_frame: 0 } });
    if (!r.ok) throw new Error('CreateGameObject failed: '+r.error);
    const goId = r.created_id;

    console.log('Setting keyframe...');
    r = dispatch({ SetKeyFrame: { game_object_id: goId, component_type: 'Transform', prop_name: 'position', keyframe: { frame: 10, value: { x: 100, y: 200 }, easing: 'linear' } } });
    if (!r.ok) throw new Error('SetKeyFrame failed: '+r.error);

    console.log('Querying interpolated props...');
    const q = query({ GetInterpolatedProps: { game_object_id: goId, frame: 10 } });
    if (!q.ok) throw new Error('GetInterpolatedProps failed: '+q.error);
    const props = q.data;
    if (!props || !props.Transform || !props.Transform.position) {
      console.error('Interpolated props missing:', props);
      process.exit(2);
    }
    const pos = props.Transform.position;
    if (pos.x !== 100 || pos.y !== 200) {
      console.error('Interpolated position mismatch:', pos);
      process.exit(3);
    }

    console.log('Record keyframe test passed');
    process.exit(0);
  }catch(err){
    console.error('ERROR', err && err.stack ? err.stack : err);
    process.exit(4);
  }
})();
