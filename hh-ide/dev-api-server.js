// Dev API server for hh-ide
// - WebSocket broker between external clients and browser bridge
// - Simple REST endpoints to forward CLI-like commands to connected browser

const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const bodyParser = require('body-parser');

const PORT = process.env.HH_DEV_API_PORT ? parseInt(process.env.HH_DEV_API_PORT, 10) : 3007;
const TOKEN = process.env.HH_DEV_API_TOKEN || null; // optional token guard

function requireToken(req, res, next) {
  if (!TOKEN) return next();
  const t = req.get('X-HH-DEV-TOKEN');
  if (t && t === TOKEN) return next();
  res.status(401).json({ error: 'unauthorized' });
}

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Keep a single browser client (the IDE) — if multiple connected, pick the last.
let browserClient = null;
let browserClientId = null;

wss.on('connection', (ws, req) => {
  console.log('[dev-api] ws connection from', req.socket.remoteAddress);
  ws.isBrowser = false;

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      // handshake from browser bridge
      if (msg && msg.type === 'hh_bridge_hello') {
        ws.isBrowser = true;
        browserClient = ws;
        browserClientId = msg.clientId || 'browser';
        console.log('[dev-api] registered browser client', browserClientId);
        return;
      }
      // otherwise logs or responses
      console.log('[dev-api] ws msg:', msg.type || '', msg);
    } catch (e) {
      console.warn('[dev-api] non-json ws message', raw.toString());
    }
  });

  ws.on('close', () => {
    if (ws === browserClient) { browserClient = null; browserClientId = null; }
    console.log('[dev-api] ws closed');
  });
});

// POST /api/command { id?, method, params }
app.post('/api/command', requireToken, async (req, res) => {
  if (!browserClient || browserClient.readyState !== WebSocket.OPEN) {
    return res.status(503).json({ error: 'no-browser-connected' });
  }
  const payload = req.body;
  const id = payload.id || (Math.random().toString(36).slice(2));
  const method = payload.method;
  const params = payload.params || {};

  // Proxy to browser and await response
  const reqMsg = JSON.stringify({ id, type: 'hh_request', method, params });

  try {
    const reply = await new Promise((resolve, reject) => {
      const ok = () => reject(new Error('ws closed'));
      const onMsg = (raw) => {
        try {
          const m = JSON.parse(raw.toString());
          if (m && m.type === 'hh_response' && m.id === id) {
            browserClient.removeListener('message', onMsg);
            resolve(m);
          }
        } catch (e) { /* ignore */ }
      };
      browserClient.on('message', onMsg);
      browserClient.send(reqMsg, (err) => { if (err) { browserClient.removeListener('message', onMsg); reject(err); } });
      // timeout
      setTimeout(() => { browserClient.removeListener('message', onMsg); reject(new Error('timeout')); }, 10000);
    });
    return res.json({ id, result: reply.result, error: reply.error || null });
  } catch (err) {
    console.error('[dev-api] forward error', err && err.stack ? err.stack : err);
    return res.status(500).json({ error: String(err) });
  }
});

// Convenience playback control endpoints
app.post('/api/play', requireToken, (req, res) => {
  return app.handle({ method: 'POST', url: '/api/command', headers: req.headers, body: { method: 'kernel.play' } }, res);
});
app.post('/api/pause', requireToken, (req, res) => {
  return app.handle({ method: 'POST', url: '/api/command', headers: req.headers, body: { method: 'kernel.pause' } }, res);
});
app.post('/api/stop', requireToken, (req, res) => {
  return app.handle({ method: 'POST', url: '/api/command', headers: req.headers, body: { method: 'kernel.stop' } }, res);
});

app.get('/api/status', requireToken, (req, res) => {
  res.json({ browserConnected: !!browserClient, browserClientId });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-api] listening on http://127.0.0.1:${PORT}`);
});

// Graceful
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
