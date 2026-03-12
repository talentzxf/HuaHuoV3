(function(){
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
