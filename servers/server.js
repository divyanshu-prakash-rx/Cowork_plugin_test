#!/usr/bin/env node
// MCP stdio server — thin dispatcher.
//
// Responsibilities:
//   1. Construct shared clients (registry, A2A, sessions).
//   2. Read tool modules from ./tools and expose them via MCP.
//   3. Frame/unframe NDJSON on stdin/stdout (per the MCP stdio spec).
//
// All real work lives in:
//   lib/         — config, http, sessions, registry-client, a2a-client, flow-builder
//   tools/*.js   — one file per MCP tool, each exporting { schema, handler }
//
// To add a new tool: drop a file in tools/ and add it to the `tools` array
// below. No other changes needed.

const cfg = require('./lib/config');
const { SessionStore }          = require('./lib/sessions');
const { PhiniteRegistryClient } = require('./lib/registry-client');
const { PhiniteA2AClient }      = require('./lib/a2a-client');

const tools = [
  require('./tools/list-agents'),
  require('./tools/discover-agent'),
  require('./tools/invoke-agent'),
  require('./tools/create-flow'),
];

// ─── Shared clients (built once at startup) ──────────────────────────────────

const sessions = new SessionStore();
const registry = new PhiniteRegistryClient();
const a2a      = new PhiniteA2AClient({ sessionStore: sessions, registryClient: registry });
const ctx      = { registry, a2a, sessions, cfg };

// One-line stderr announce so we can confirm which build is loaded.
console.error(
  `[phinite-mcp v${cfg.SERVER_VERSION}] booted ${new Date().toISOString()}  ` +
  `app=${cfg.APP_BASE_URL}  a2a=${cfg.A2A_BASE_URL}  ` +
  `workspace=${cfg.WORKSPACE_ID || '(none — falling back to PHINITE_AGENT_IDS)'}  ` +
  `apiKey=${cfg.API_KEY ? 'set' : 'MISSING'}  ` +
  `creds=${cfg.CREDENTIALS_SOURCE || '(none — using env only)'}  ` +
  `sessions=${cfg.SESSIONS_FILE}  tools=${tools.length}`
);

// ─── MCP stdio framing — NDJSON, one JSON-RPC message per line ───────────────

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

async function handle(msg) {
  const { id, method, params } = msg;

  if (method === 'initialize') {
    return send({
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities:    { tools: {} },
        serverInfo:      { name: 'phinite', version: cfg.SERVER_VERSION },
      },
    });
  }

  if (!method || method.startsWith('notifications/') || method === 'initialized') {
    return;
  }

  if (method === 'tools/list') {
    return send({
      jsonrpc: '2.0', id,
      result:  { tools: tools.map((t) => t.schema) },
    });
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    const tool = tools.find((t) => t.schema.name === name);
    try {
      if (!tool) throw new Error(`Unknown tool: ${name}`);
      const result = await tool.handler(args || {}, ctx);
      return send({
        jsonrpc: '2.0', id,
        result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] },
      });
    } catch (err) {
      return send({
        jsonrpc: '2.0', id,
        result: {
          content: [{ type: 'text', text: `Error: ${err.message}` }],
          isError: true,
        },
      });
    }
  }

  if (id !== undefined) {
    send({ jsonrpc: '2.0', id, error: { code: -32601, message: 'Method not found' } });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).replace(/\r$/, '');
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch { continue; }
    handle(msg).catch((err) => {
      if (msg.id !== undefined) {
        send({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: err.message } });
      }
    });
  }
});
