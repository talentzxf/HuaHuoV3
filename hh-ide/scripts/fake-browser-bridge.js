// Fake browser bridge that connects to dev-api-server WS and delegates requests to kernel-wasm (for e2e demos)
const WebSocket = require('ws');
const path = require('path');

(async () => {
  const wsUrl = 'ws://127.0.0.1:3007';
  console.log('[fake-bridge] starting, connecting to', wsUrl);

  // load kernel-wasm module
  const modPath = path.resolve(__dirname, '..', '..', 'packages', 'kernel-wasm', 'index.js');
  const mod = require(modPath);
  const initFn = typeof mod.default === 'function' ? mod.default : (typeof mod.init === 'function' ? mod.init : (typeof mod === 'function' ? mod : null));
  if (initFn) await initFn();
  const KernelAPI = mod.KernelAPI || mod.default?.KernelAPI;
  if (!KernelAPI) throw new Error('KernelAPI not found in module');
  const api = new KernelAPI();

  const ws = new WebSocket(wsUrl);
  ws.on('open', () => {
    console.log('[fake-bridge] ws open');
    ws.send(JSON.stringify({ type: 'hh_bridge_hello', clientId: 'fake-bridge' }));
  });

  ws.on('message', async (data) => {
    let msg = null;
    try { msg = JSON.parse(data.toString()); } catch (e) { console.warn('non-json', data.toString()); return; }
    if (msg && msg.type === 'hh_request') {
      const { id, method, params } = msg;
      let result = null; let error = null;
      try {
        if (method === 'kernel.dispatch') {
          result = JSON.parse(api.dispatch(JSON.stringify(params.cmd)));
        } else if (method === 'kernel.query') {
          result = JSON.parse(api.query(JSON.stringify(params.q)));
        } else if (method === 'kernel.play') {
          result = JSON.parse(api.dispatch(JSON.stringify({ Play: null })));
        } else if (method === 'kernel.pause') {
          result = JSON.parse(api.dispatch(JSON.stringify({ Pause: null })));
        } else if (method === 'kernel.stop') {
          result = JSON.parse(api.dispatch(JSON.stringify({ Stop: null })));
        } else {
          error = 'unknown method';
        }
      } catch (e) { error = String(e); }
      const resp = { type: 'hh_response', id, result, error };
      ws.send(JSON.stringify(resp));
    }
  });

  ws.on('close', () => { console.log('[fake-bridge] ws closed'); process.exit(0); });
  ws.on('error', (e) => { console.error('[fake-bridge] ws error', e && e.message); });
})();
