// Centralised config — env-var parsing and the SERVER_VERSION marker.
// Every other module reads from this so we have one place to change defaults.

const fs   = require('fs');
const path = require('path');

const SERVER_VERSION = '0.4.3-credentials-file';

// ─── Credentials loading ─────────────────────────────────────────────────────
//
// Secrets (PHINITE_API_KEY, PHINITE_WORKSPACE_ID, etc.) can live in a JSON
// file outside .mcp.json so they aren't committed to git. Lookup order:
//
//   1. process.env (whatever .mcp.json injected)               — wins if set
//   2. credentials.json file                                   — fallback
//
// The file is searched in (first hit wins):
//   • PHINITE_CREDENTIALS_FILE env var (absolute path)
//   • <plugin root>/credentials.json   (recommended — gitignored)
//   • <servers/>/credentials.json
//
// Shape:
//   { "PHINITE_API_KEY": "...", "PHINITE_WORKSPACE_ID": "..." }
//
// See credentials.example.json for the template.

function loadCredentialsFile() {
  const pluginRoot = path.join(__dirname, '..', '..');            // <plugin root>
  const candidates = [
    process.env.PHINITE_CREDENTIALS_FILE,
    path.join(pluginRoot, 'credentials.json'),
    path.join(__dirname, '..', 'credentials.json'),               // servers/credentials.json
  ].filter(Boolean);

  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const obj = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (obj && typeof obj === 'object') {
          return { values: obj, source: file };
        }
      }
    } catch (e) {
      console.error(`[phinite-mcp] failed to read credentials file ${file}: ${e.message}`);
    }
  }
  return { values: {}, source: null };
}

const credentials = loadCredentialsFile();

// process.env wins; credentials.json fills gaps.
function pick(key, fallback = '') {
  if (process.env[key] != null && process.env[key] !== '') return process.env[key];
  if (credentials.values[key] != null && credentials.values[key] !== '') return credentials.values[key];
  return fallback;
}

// ─── Resolved config ─────────────────────────────────────────────────────────

const API_KEY      = pick('PHINITE_API_KEY');
const WORKSPACE_ID = pick('PHINITE_WORKSPACE_ID');

// Two distinct base URLs:
//   APP   — REST API (registry, flows, tools). Bearer auth required.
//   A2A   — Agent-to-Agent JSON-RPC (SendMessage). X-Api-Key auth required.
const APP_BASE_URL = pick('PHINITE_APP_BASE_URL', 'https://app-dev.phinite.ai/api/v1').replace(/\/$/, '');
const A2A_BASE_URL = pick('PHINITE_A2A_BASE_URL', 'https://ai-core-dev.phinite.ai').replace(/\/$/, '');

// Backwards-compat fallback list when WORKSPACE_ID is not set.
const FALLBACK_AGENT_IDS = pick('PHINITE_AGENT_IDS', '')
  .split(',').map(s => s.trim()).filter(Boolean);

// Cowork respawns the MCP child process between user turns, so any in-memory
// state vanishes. We persist contextId→taskId to disk so sessions survive.
const SESSIONS_FILE = pick('PHINITE_SESSIONS_FILE', path.join(__dirname, '..', 'sessions.json'));
const SESSIONS_MAX  = parseInt(pick('PHINITE_SESSIONS_MAX', '500'), 10);

// Source path of any credentials file we loaded (for boot logging).
const CREDENTIALS_SOURCE = credentials.source;

// Note: the A2A endpoint authenticates via X-Api-Key (see a2a-client.js);
// the registry endpoint uses Authorization: Bearer. Both carry PHINITE_API_KEY.

module.exports = {
  SERVER_VERSION,
  API_KEY,
  WORKSPACE_ID,
  APP_BASE_URL,
  A2A_BASE_URL,
  FALLBACK_AGENT_IDS,
  SESSIONS_FILE,
  SESSIONS_MAX,
  CREDENTIALS_SOURCE,
};
