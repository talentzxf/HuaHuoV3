(function(){
  // WebSocket JSON-RPC bridge to dev-api-server
  const wsUrl = (location.protocol === 'https:' ? 'wss' : 'ws') + '://127.0.0.1:' + (window.__HH_DEV_API_PORT || '3007');
  let ws = null;
  function connect() {
    try {
      ws = new WebSocket(wsUrl);
      ws.addEventListener('open', () => {
        console.log('[hh-bridge] ws connected to dev-api');
        ws.send(JSON.stringify({ type: 'hh_bridge_hello', clientId: 'hh-ide-browser' }));
      });
      ws.addEventListener('message', async (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg && msg.type === 'hh_request') {
            // handle request { id, method, params }
            const { id, method, params } = msg;
            let result = null; let error = null;
            try {
              // KernelBridge methods
              if (method === 'kernel.dispatch') {
                result = window.getKernel().dispatch(params.cmd);
              } else if (method === 'kernel.query') {
                result = window.getKernel().query(params.q);

              // Playback controls
              } else if (method === 'kernel.play') {
                window.getKernel().play(); result = {ok:true};
              } else if (method === 'kernel.pause') {
                window.getKernel().pause(); result = {ok:true};
              } else if (method === 'kernel.stop') {
                window.getKernel().stop(); result = {ok:true};

              // SDK / Editor helpers
              } else if (method === 'sdk.editor.setTool') {
                if (window.SDK && SDK.isInitialized()) { SDK.instance.Editor.setCurrentTool(params.tool); result = {ok:true}; }
                else error = 'SDK not initialized';
              } else if (method === 'sdk.editor.createGameObject') {
                // params: layerName, paperItemProps
                if (window.SDK && SDK.isInitialized()) {
                  // Create a simple paper item via SDK/engine path: use SDK.instance.Engine.createGameObjectFromPaperItem is internal; we try Editor API if exists
                  try {
                    const canvasScope = SDK.instance.getPaperScope();
                    // Create a temporary Paper.js shape if props provided
                    const p = params.paper || { type: 'rect', x: 10, y: 10, w: 50, h: 50 };
                    let item = null;
                    if (p.type === 'rect') {
                      item = new canvasScope.Path.Rectangle({ point: [p.x, p.y], size: [p.w, p.h], fillColor: p.fillColor || null });
                    } else if (p.type === 'circle') {
                      item = new canvasScope.Path.Circle({ center: [p.x, p.y], radius: p.r || 20, fillColor: p.fillColor || null });
                    }
                    if (item) {
                      const go = SDK.instance.createGameObjectFromPaperItem(item, params.layerName);
                      result = { ok: true, gameObjectId: go?.id ?? null };
                    } else {
                      error = 'failed to create paper item';
                    }
                  } catch (e) { error = String(e); }
                } else error = 'SDK not initialized';

              // Timeline helpers
              } else if (method === 'timeline.mergeKeyframes') {
                // Forward as kernel.dispatch if kernel has MergeKeyFrames command implemented
                if (window.getKernel) {
                  try { result = window.getKernel().dispatch({ MergeKeyFrames: params }); }
                  catch(e) { error = String(e); }
                } else error = 'kernel not available';

              } else {
                error = 'unknown method';
              }
            } catch (e) { error = String(e); }
            ws.send(JSON.stringify({ type: 'hh_response', id, result, error }));
          }
        } catch (e) { /* ignore */ }
      });
      ws.addEventListener('close', () => { console.log('[hh-bridge] ws closed, reconnecting in 1s'); setTimeout(connect, 1000); });
      ws.addEventListener('error', (e) => { console.warn('[hh-bridge] ws error', e); });
    } catch (e) { console.warn('[hh-bridge] connect failed', e); setTimeout(connect, 1000); }
  }
  connect();

  // Bridge to post playback events to dev server for capture
  try{
    window.__hh_bridge = window.__hh_bridge || {};
    if (window.__hh_bridge._installed) return;
    window.__hh_bridge._installed = true;
    function post(obj){
      try{ navigator.sendBeacon('/__hh_playback_log', JSON.stringify(obj)); }catch(e){}
    }
    // Listen to console for kernel messages too
    const origConsoleLog = console.log;
    console.log = function(){
      try{ post({topic:'console', args: Array.from(arguments)}); }catch(e){}
      origConsoleLog.apply(console, arguments);
    };
    // Try subscribe via global kernel if available
    function tryWire(){
      try{
        const kb = window.__hh_kernelbridge || (window.getKernel && window.getKernel());
        if (kb && kb.subscribe){
          try{
            kb.subscribe('playback/frame_changed', (ev)=> post({topic:'playback/frame_changed', ev}));
            kb.subscribe('playback/started', ()=> post({topic:'playback/started'}));
            kb.subscribe('playback/paused', ()=> post({topic:'playback/paused'}));
            kb.subscribe('playback/stopped', ()=> post({topic:'playback/stopped'}));
            post({topic:'bridge_installed'});
            return true;
          }catch(e){ post({topic:'bridge_error', error: String(e)}); }
        }
      }catch(e){/* ignore */}
      return false;
    }
    // Retry wiring a few times
    let tries=0; const iv = setInterval(()=>{ if(tryWire()||++tries>20){ clearInterval(iv);} }, 500);
  }catch(e){/* ignore */}
})();
