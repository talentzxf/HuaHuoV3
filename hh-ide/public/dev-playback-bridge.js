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
              if (method === 'kernel.dispatch') {
                result = window.getKernel().dispatch(params.cmd);
              } else if (method === 'kernel.query') {
                result = window.getKernel().query(params.q);
              } else if (method === 'kernel.play') {
                window.getKernel().play(); result = {ok:true};
              } else if (method === 'kernel.pause') {
                window.getKernel().pause(); result = {ok:true};
              } else if (method === 'kernel.stop') {
                window.getKernel().stop(); result = {ok:true};
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
