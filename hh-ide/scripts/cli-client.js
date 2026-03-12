const axios = require('axios');
const uuid = require('uuid');

const BASE = process.env.HH_DEV_API_URL || 'http://127.0.0.1:3007';
const TOKEN = process.env.HH_DEV_API_TOKEN || null;

async function send(method, params) {
  const id = uuid.v4();
  try {
    const resp = await axios.post(BASE + '/api/command', { id, method, params }, { headers: TOKEN ? { 'X-HH-DEV-TOKEN': TOKEN } : {} });
    console.log('resp:', resp.data);
  } catch (e) {
    console.error('error:', e && e.response ? e.response.data : e.message);
  }
}

// Simple CLI: node scripts/cli-client.js kernel.dispatch '{"cmd":{...}}'
const args = process.argv.slice(2);
if (args.length < 1) { console.log('Usage: node scripts/cli-client.js <method> <json-params>'); process.exit(1); }
const method = args[0];
let params = {};
if (args[1]) {
  try { params = JSON.parse(args[1]); } catch(e) { console.error('invalid json param'); process.exit(2); }
}
send(method, params);
