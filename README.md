# Phinite Agents Plugin

A Claude (Cowork) plugin that exposes Phinite's **A2A (Agent-to-Agent) protocol**
over MCP. Claude can list published agents and invoke them with natural language,
with conversation memory preserved across user turns.

```
Cowork (Claude) ──MCP stdio──▶ servers/server.js ──HTTPS──▶ https://ai-core-dev.phinite.ai
                                                            (real Phinite A2A backend)
```

> Why is `server.js` even there? Because Cowork plugins expose tools to Claude
> over MCP, and the real Phinite endpoint doesn't yet speak MCP directly.
> `server.js` is a thin bridge: MCP on one side, Phinite's A2A JSON-RPC on the
> other. See [Production deployment](#production--marketplace-deployment) for
> when and how to drop this bridge.

---

## Tools exposed to Claude

| MCP tool | What it does |
|----------|--------------|
| `phinite_list_agents` | Returns every Agent Card configured via `PHINITE_AGENT_IDS`. Phinite has no public registry endpoint yet, so the list is a hardcoded set of discovery IDs. |
| `phinite_discover_agent` | Returns the full Agent Card for one discovery ID. |
| `phinite_invoke_agent` | Sends a message to an agent via JSON-RPC `SendMessage`. Returns answer, `taskId`, and `contextId` (use the latter as `sessionId` on the next call for conversation continuity). |
| `phinite_create_flow` | **Currently unavailable.** The platform's flow-creation endpoint isn't live yet. Tool stays registered but returns a clear error. |

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| Cowork desktop app | latest | Host that loads the plugin |
| Node.js | ≥ 18 | Runs `servers/server.js` |
| `zip` | any | Packaging into `.plugin` |
| Python ≥ 3.9 + `flask` | latest | **Optional** — only needed if you want to run the local A2A simulator for offline development |

---

## Quick Start (talk to the real Phinite platform)

This is the default path. No simulator, no localhost services.

### 1. Edit `.mcp.json`

Cowork reads this file when it installs the plugin to learn how to launch the
MCP server.

```json
{
  "mcpServers": {
    "phinite": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": ["C:\\absolute\\path\\to\\Phinite Plugin\\servers\\server.js"],
      "env": {
        "PHINITE_API_KEY":   "pk_dev_test_key_openclaw",
        "PHINITE_BASE_URL":  "https://ai-core-dev.phinite.ai",
        "PHINITE_AGENT_IDS": "YtzU43HFG"
      }
    }
  }
}
```

> **Paths must be absolute.** The `command` and `args[0]` paths must be the
> absolute paths on your machine. On Windows, escape backslashes (`\\`).

### 2. Package the plugin

```bash
cd "Phinite Plugin"
rm -f phinite.plugin
zip -r phinite.plugin . -x "logs/*" "**/_test_*.js" "**/_e2e*.js" "**/.DS_Store"
```

The zip must have the files **at its root**, not nested under a top-level
directory:

```
✅ Correct                              ❌ Wrong
.claude-plugin/plugin.json              Phinite Plugin/.claude-plugin/plugin.json
.mcp.json                               Phinite Plugin/.mcp.json
servers/server.js                       Phinite Plugin/servers/server.js
```

### 3. Install in Cowork

Drag and drop `phinite.plugin` into the Cowork chat window. Cowork unpacks it,
reads `.claude-plugin/plugin.json` for metadata, and reads `.mcp.json` to learn
how to spawn the MCP server.

### 4. Test in chat

- *"What Phinite agents do I have access to?"* → triggers `phinite_list_agents`.
- *"Ask the LinkedIn Reviewer to review this post: ..."* → `phinite_invoke_agent`.
- *"Make it shorter and remove the emoji"* → follow-up; Claude reuses the
  `contextId` from the previous response. The agent should remember the original
  post.

To **expose more agents**, append their discovery IDs to `PHINITE_AGENT_IDS`:

```
"PHINITE_AGENT_IDS": "YtzU43HFG,anotherAgentId,thirdAgentId"
```

then repackage and reinstall.

---

## Configuration — environment variables

All set via `.mcp.json` under `env`.

| Var | Default | Purpose |
|-----|---------|---------|
| `PHINITE_BASE_URL` | `https://ai-core-dev.phinite.ai` | Base URL of the Phinite A2A backend. |
| `PHINITE_API_KEY` | *(empty)* | Bearer token sent on every request. The dev endpoint doesn't currently require it. |
| `PHINITE_AGENT_IDS` | `YtzU43HFG` | Comma-separated discovery IDs the plugin should expose as a "registry". |
| `PHINITE_SESSIONS_FILE` | `<plugin>/servers/sessions.json` | Where to persist the `contextId → taskId` map so sessions survive between Cowork user turns. |
| `PHINITE_SESSIONS_MAX` | `500` | LRU cap on persisted sessions. |

---

## Rebuilding and reinstalling

Every code change in `server.js`, `SKILL.md`, `.mcp.json`, etc. requires this
loop (Cowork uses its installed copy, not the source folder):

1. Bump `SERVER_VERSION` in `servers/server.js`.
2. `rm -f phinite.plugin && zip -r phinite.plugin . -x "logs/*"`.
3. In Cowork: uninstall the previous plugin version.
4. **Quit Cowork from the system tray** (closing the window isn't enough).
5. Reopen Cowork. Drag in the new `phinite.plugin`.
6. First `phinite_invoke_agent` response will include `_debug.serverVersion` —
   confirm it matches what you bumped to.

If the `_debug` field is missing or the version is stale, Cowork is still
running the old copy. Repeat the loop with a more aggressive uninstall.

---

## Optional — running the local A2A simulator

There's a Flask simulator at `Extra/Openclaw_External/simulator/phinite_A2A.py`
useful for offline development (network-free travel, testing flow creation
locally, etc.). It is **not** required for normal use.

```bash
pip install flask
python "Extra/Openclaw_External/simulator/phinite_A2A.py"
```

Dashboard at <http://localhost:3001>. It exposes its own `/api/flows` endpoint
which the production platform doesn't yet have — so flow creation works against
the simulator but not against `ai-core-dev.phinite.ai`.

To point the plugin at the simulator instead of the real backend, change
`.mcp.json`:

```json
"PHINITE_BASE_URL": "http://localhost:3001",
"PHINITE_API_KEY":  "pk_dev_test_key_openclaw"
```

| Simulator var | Default | Purpose |
|---------------|---------|---------|
| `PHINITE_API_KEY` | `pk_dev_test_key_openclaw` | Bearer token enforced by the simulator. |
| `PHINITE_PORT` | `3001` | TCP port. |
| `PHINITE_DEBUG` | `1` | Verbose logging (`0` to silence). |
| `PHINITE_FLOWS_FILE` | `<simulator dir>/flows.json` | Persists user-created flows. |

> Note: the simulator uses an older protocol shape (`tasks/send`, single-ID URLs)
> that the production backend has moved past. The plugin's `server.js` targets the
> production shape — so the simulator and plugin can drift. If they do, prefer
> the production shape.

---

## Production / Marketplace Deployment

When you want to publish the plugin to the Cowork marketplace so anyone can
install it without setting up Node.js or `.mcp.json` paths.

### Approach 1 — keep `server.js`, host it as HTTP

Wrap `server.js`'s `handle()` function in an HTTP server and deploy it.

`.mcp.json` switches to HTTP mode:

```json
{
  "mcpServers": {
    "phinite": {
      "type": "http",
      "url":  "https://mcp.phinite.ai",
      "headers": { "Authorization": "Bearer ${PHINITE_API_KEY}" }
    }
  }
}
```

Users only need to enter their API key in Cowork's settings panel. Remove
`command`, `args`, `env` from `.mcp.json`.

### Approach 2 — embed MCP directly in the Phinite backend (recommended)

If the Phinite API itself implements MCP's HTTP endpoint, `server.js` disappears
entirely. The Phinite backend handles:

```
POST /mcp   →  { initialize, tools/list, tools/call }
```

Inside `tools/call`, the backend calls its own internal logic instead of looping
back through HTTP. One service to deploy instead of two.

### Update `plugin.json` settings

Drop `PHINITE_BASE_URL` from the settings panel (hardcoded server-side). Keep
just the API key:

```json
"settings": {
  "PHINITE_API_KEY": {
    "label": "Phinite API Key",
    "description": "Get your key from phinite.ai/dashboard/api-keys",
    "type": "secret",
    "required": true,
    "placeholder": "pk_..."
  }
}
```

### Stdio vs HTTP comparison

|                       | Local (stdio)         | Marketplace (http)        |
|-----------------------|-----------------------|---------------------------|
| MCP server runs on    | User's machine        | Your server               |
| Requires Node.js      | Yes                   | No                        |
| Auth                  | Env vars              | Bearer header             |
| User setup            | Edit `.mcp.json`      | Enter API key             |
| Works in marketplace  | No                    | Yes                       |
| Best for              | Development & testing | Production & distribution |

---

## A2A Protocol Reference

What `server.js` actually sends to `PHINITE_BASE_URL`. These are the shapes used
by the production endpoint. The simulator uses an older shape; if you fork
either, prefer the shapes below.

### Agent card discovery

```
GET /a2a/<discoveryId>/.well-known/agent-card.json
```

Returns:

```json
{
  "name": "LinkedIN Reviewer",
  "description": "Review linkedin post and suggest changes.",
  "skills": [ ... ],
  "auth_schemes": ["API Key"],
  "supportedInterfaces": [
    {
      "url": "https://ai-core-dev.phinite.ai/a2a/agents/trmW_x2i46F8",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "2.0"
    }
  ]
}
```

The discovery ID (`YtzU43HFG`) and the task-URL ID (`trmW_x2i46F8`) are
**different** — always fetch the card first and read `supportedInterfaces[0].url`
to get the real task endpoint.

### Send a message (turn 1)

```
POST <supportedInterfaces[0].url>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendMessage",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "type": "text", "text": "your question" }]
    }
  }
}
```

Response (abridged):

```json
{
  "result": {
    "task": {
      "id":        "<taskId>",
      "contextId": "<contextId>",
      "status":    { "state": "TASK_STATE_INPUT_REQUIRED" },
      "artifacts": [{ "parts": [{ "text": "agent's reply" }] }]
    }
  }
}
```

### Continue the conversation (turn 2+)

**Both** `contextId` and the prior `taskId` must be inside `message`:

```json
{
  "jsonrpc": "2.0", "id": 2, "method": "SendMessage",
  "params": {
    "message": {
      "role": "user",
      "parts": [{ "type": "text", "text": "follow-up" }],
      "contextId": "<from turn 1>",
      "taskId":    "<from turn 1>"
    }
  }
}
```

If you forget `taskId`, Phinite still echoes the `contextId` back but the agent
won't load any history. The plugin's `PhiniteA2AClient` handles this for you
via its on-disk `sessions.json` map — Claude only needs to round-trip the
opaque `sessionId`.

### Task statuses

| Status | Meaning |
|--------|---------|
| `TASK_STATE_INPUT_REQUIRED` | Conversation is open — agent expects more input. **Not** an error. |
| `TASK_STATE_COMPLETED` | Terminal — agent considers the task done. |
| `TASK_STATE_FAILED` | Terminal — something went wrong. |

---

## How session memory works

Phinite's `SendMessage` only loads conversation history when **both** `contextId`
**and** the prior `taskId` are in the request `message`. Claude only knows about
the opaque `sessionId` it gets back. The plugin bridges this:

1. `PhiniteA2AClient` maintains `_lastTaskByContext: Map<contextId, taskId>`.
2. After every response, the map is updated and persisted to `sessions.json`.
3. On the next call, if the incoming `sessionId` matches a known `contextId`,
   the prior `taskId` is added to the outgoing message.
4. Because Cowork respawns the MCP child process between user turns, the map
   **must** live on disk — in-memory alone is wiped every turn.

The `_debug` field on every `phinite_invoke_agent` response shows what the
plugin actually sent:

```json
"_debug": {
  "serverVersion":    "0.3.2-persistent-sessions",
  "inboundContextId": "abc-...",
  "priorTaskIdFound": "xyz-...",      // null if no prior taskId in map
  "sentTaskIdInMsg":  "xyz-...",      // null if we didn't forward one
  "mapSize":          12              // total persisted sessions
}
```

Use this to diagnose deployment issues (see Troubleshooting below).

---

## Plugin File Reference

| File | Edit when you want to… |
|------|------------------------|
| `servers/server.js` | Add/change MCP tools, fix endpoint paths, adjust A2A client behavior. |
| `servers/sessions.json` | *Generated at runtime.* Delete to wipe all session memory. |
| `skills/phinite-agents/SKILL.md` | Change how Claude decides to use Phinite, document new tools. |
| `.mcp.json` | Configure how Cowork spawns the MCP server (env vars, transport mode). |
| `.claude-plugin/plugin.json` | Update plugin name, version, settings panel. |
| `hooks/hooks.json` | Configure post-tool-call hooks. |
| `hooks/scripts/log-api-call.sh` | Adjust what gets logged on each tool call. |
| `Extra/Openclaw_External/simulator/phinite_A2A.py` | Optional local A2A simulator. |
| `Extra/Openclaw_External/simulator/flows.json` | *Generated at runtime.* Simulator's persisted flows. |

---

## Troubleshooting

Each row tells you what to read in the `_debug` block of a follow-up
`phinite_invoke_agent` response, and what it means:

| Symptom | What `_debug` shows | Root cause | Fix |
|---------|---------------------|------------|-----|
| Plugin installed but no tools appear | (can't see anything) | MCP server failed to spawn | Verify `command` and `args[0]` paths in `.mcp.json` are absolute and exist; check Node ≥ 18 |
| Tool calls hang or return no response | (can't see anything) | Wrong MCP framing | If you forked `server.js`, ensure it uses NDJSON (`\n`-delimited), not LSP `Content-Length` |
| `_debug` field missing from invoke responses | no `_debug` at all | Cowork loaded an old `server.js` | Uninstall plugin, quit Cowork from system tray, reinstall, reopen |
| Follow-up forgets context | new `serverVersion` but `priorTaskIdFound: null` and `mapSize: 1` after each turn | Disk persistence isn't working (file unwritable, wrong path, etc.) | Check `PHINITE_SESSIONS_FILE`; ensure the directory is writable. Inspect `servers/sessions.json` directly |
| Follow-up forgets context | `priorTaskIdFound` and `sentTaskIdInMsg` are correct, but agent still asks for the post | Phinite-side memory not enabled on the agent | Server-side fix needed on the Phinite team |
| `phinite_create_flow` returns "currently unavailable" | n/a | Production platform doesn't expose `POST /api/flows` yet | Wait for platform support; or run the local simulator (Optional section above) which does have the endpoint |
| `401 Unauthorized` | n/a | `PHINITE_API_KEY` is wrong | Update `.mcp.json`, repackage, reinstall |
| `ECONNREFUSED` | n/a | Wrong base URL or simulator not running | Check `PHINITE_BASE_URL` |
| Edited `.mcp.json` but Cowork still uses old values | n/a | Cowork's installed copy is independent from your source folder | Rezip and reinstall, or edit the installed copy directly via *Customize → Phinite agents → Connectors → Edit* |

For the long-form story of every issue we hit and why each fix looks the way
it does, see [DEBUGGING.md](DEBUGGING.md).

---

# Technical Reference

A deep-dive into every file, every function, and every parameter.

---

## System overview — how all pieces connect

```
User types in Cowork chat
        │
        ▼
Cowork (Claude)
  reads skills/phinite-agents/SKILL.md → decides which MCP tool to call
        │
        │  stdin/stdout (newline-delimited JSON-RPC)
        ▼
servers/server.js
  (Node.js child process, spawned by Cowork via .mcp.json)
  receives tools/call → PhiniteA2AClient → HTTPS request
        │
        │  HTTPS + (optional) Bearer token
        ▼
Phinite A2A backend  (https://ai-core-dev.phinite.ai)
        │
        ▼
Response bubbles back → Claude relays the answer to the user
```

Config glue:

| File | Read by | Purpose |
|------|---------|---------|
| `.mcp.json` | Cowork | How to spawn `server.js`, which env vars to pass |
| `.claude-plugin/plugin.json` | Cowork | Plugin metadata + user settings panel |
| `skills/phinite-agents/SKILL.md` | Claude | When and how to use each tool |
| `hooks/hooks.json` | Cowork hook runner | Post-tool-call shell hooks |

---

## File: `.mcp.json`

```json
{
  "mcpServers": {
    "phinite": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args":    ["C:\\...\\servers\\server.js"],
      "env": {
        "PHINITE_API_KEY":   "...",
        "PHINITE_BASE_URL":  "https://ai-core-dev.phinite.ai",
        "PHINITE_AGENT_IDS": "YtzU43HFG"
      }
    }
  }
}
```

| Field | Type | Purpose |
|-------|------|---------|
| `command` | string | Absolute path to `node`. |
| `args[0]` | string | Absolute path to `server.js`. |
| `env.PHINITE_API_KEY` | string | Bearer token. Optional on the dev endpoint. |
| `env.PHINITE_BASE_URL` | string | Phinite backend URL (no trailing slash). |
| `env.PHINITE_AGENT_IDS` | string | Comma-separated discovery IDs the plugin exposes. |

For marketplace HTTP mode, replace the entire object with `{ "type": "http", "url": "...", "headers": { "Authorization": "Bearer ${PHINITE_API_KEY}" } }`.

---

## File: `.claude-plugin/plugin.json`

Plugin identity and the settings panel Cowork shows to the user.

| Field | Purpose |
|-------|---------|
| `name` | Unique plugin ID. Also the namespace for MCP tool names (`mcp__phinite__*`). |
| `version` | Bump on every published change. |
| `settings.*` | Each key becomes an env var passed to the spawned MCP server. `type: "secret"` is stored encrypted. |

---

## File: `skills/phinite-agents/SKILL.md`

A Markdown file with YAML front matter. Claude reads it to decide *when* to use
the plugin's tools.

| Front-matter field | Purpose |
|---|---|
| `name` | Internal skill ID. Must match folder name. |
| `description` | Triggers that activate the skill (e.g. "list agents", "ask Phinite", "create a flow"). |

The body is plain prose Claude reads as runtime instructions: routing rules,
parameter semantics, follow-up handling, the "flow creation is currently
unavailable" note.

---

## File: `hooks/hooks.json` + `hooks/scripts/log-api-call.sh`

Cowork runs the shell hook after every tool call that matches the `matcher`
regex. The hook script gets the tool result on stdin and must print a JSON
decision on stdout (`{"decision":"approve"}` lets the result through).
`log-api-call.sh` simply appends each call to `logs/api-calls.log`.

---

## File: `servers/server.js`

The MCP bridge. No npm dependencies — uses only Node.js built-ins.

### Module-level constants

```js
const SERVER_VERSION = '0.3.2-persistent-sessions';
const API_KEY        = process.env.PHINITE_API_KEY  || '';
const BASE_URL       = (process.env.PHINITE_BASE_URL || 'https://ai-core-dev.phinite.ai').replace(/\/$/, '');
const AGENT_IDS      = (process.env.PHINITE_AGENT_IDS  || 'YtzU43HFG').split(',').map(s => s.trim()).filter(Boolean);
const SESSIONS_FILE  = process.env.PHINITE_SESSIONS_FILE || path.join(__dirname, 'sessions.json');
const SESSIONS_MAX   = parseInt(process.env.PHINITE_SESSIONS_MAX || '500', 10);
```

### `loadSessions() / saveSessions(map)`

Read or atomically write `SESSIONS_FILE`. The file is a flat JSON object
`{ "<contextId>": "<taskId>", ... }`. Atomic write uses `.tmp` then `rename` so
a crash mid-write never leaves a corrupt file. Both helpers log to stderr and
return silently on error — the server keeps working with an empty map.

### `class HttpError extends Error`

Carries `status` along with `message` so callers can branch on HTTP code.

### `class PhiniteA2AClient`

All Phinite-specific behavior lives here.

| Member | Purpose |
|--------|---------|
| `_cardCache: Map<discoveryId, AgentCard>` | Avoid refetching agent cards on every call. Per-process. |
| `_taskUrlCache: Map<discoveryId, string>` | Resolved `supportedInterfaces[0].url`. Per-process. |
| `_lastTaskByContext: Map<contextId, taskId>` | Loaded from `sessions.json` at startup, persisted on every write. Survives Cowork's between-turn process respawns. |

#### `fetchAgentCard(discoveryId) → Promise<AgentCard>`

`GET /a2a/<id>/.well-known/agent-card.json`. Augments the card with an `id`
field so callers can route by it. Cached.

#### `listAgents() → Promise<AgentCard[]>`

Fetches every card in `AGENT_IDS` in parallel via `Promise.allSettled`. Failed
fetches return `{ id, error }` rather than crashing the whole list.

#### `resolveTaskUrl(discoveryId) → Promise<string>`

Reads `card.supportedInterfaces[0].url` (preferring the entry where
`protocolBinding === 'JSONRPC'`). Throws if no JSON-RPC interface exists.
Cached.

#### `sendMessage(discoveryId, text, contextId?) → Promise<InvokeResult>`

The core of session memory:

1. Resolve the task URL.
2. Build `message = { role: 'user', parts: [{ type: 'text', text }] }`.
3. If `contextId` is provided:
   - Add `message.contextId = contextId`.
   - Look up `_lastTaskByContext.get(contextId)` → if found, add `message.taskId`.
4. POST `{ jsonrpc, id, method: 'SendMessage', params: { message } }`.
5. On success, **delete and re-insert** the (contextId, new taskId) pair so
   recently-used sessions move to the end of the LRU. Persist via
   `_persistSessions()`.
6. Return `{ taskId, contextId, status, answer, artifacts, _debug }`.

The `_debug` field is always included:

```js
{
  serverVersion:    SERVER_VERSION,
  inboundContextId: contextId || null,
  priorTaskIdFound: priorTaskId,        // what we found in the map
  sentTaskIdInMsg:  message.taskId || null,
  mapSize:          this._lastTaskByContext.size,
}
```

#### `_extractAnswer(artifacts) → string`

Flattens every `parts[i].text` across every artifact into one newline-joined
string. Falls back to `"No answer returned"` if there's nothing.

#### `_persistSessions()`

LRU eviction down to `SESSIONS_MAX`, then atomic save.

#### `_request(method, urlOrPath, body) → Promise<any>`

The single HTTP entry point. Accepts either a full URL or a path relative to
`BASE_URL`. Always sets `Content-Type: application/json` and `Accept`. Adds
`Authorization: Bearer <key>` only if `apiKey` is non-empty. Throws `HttpError`
on non-2xx.

### Tool dispatch

`handle(msg)` is the central router for inbound JSON-RPC messages:

| `msg.method` | Action |
|---|---|
| `initialize` | Responds with `serverInfo: { name: 'phinite', version: SERVER_VERSION }`. |
| `notifications/*`, `initialized` | Silently ignored. |
| `tools/list` | Returns all four tool schemas. |
| `tools/call` → `phinite_list_agents` | `client.listAgents()` |
| `tools/call` → `phinite_discover_agent` | `client.fetchAgentCard(args.agentId)` |
| `tools/call` → `phinite_invoke_agent` | `client.sendMessage(args.agentId, args.message, args.sessionId)` |
| `tools/call` → `phinite_create_flow` | Throws "currently unavailable" error |
| anything else | `-32601 Method not found` |

### `send(msg)` and the stdin reader

`send(msg)` writes `JSON.stringify(msg) + '\n'` to stdout. The reader
accumulates stdin chunks, splits on `\n`, parses each line, and dispatches
through `handle()`. CRLF is normalized by stripping trailing `\r`.

### Boot announce

```
[phinite-mcp v0.3.2-persistent-sessions] booted <iso>  base=<url>  agents=<list>  sessions=<file>  loaded=<N>
```

Written to stderr at startup. `loaded=N` is the count of sessions rehydrated
from disk — useful for confirming persistence is working.

---

## Optional file: `Extra/Openclaw_External/simulator/phinite_A2A.py`

A single-file Flask app that emulates the Phinite backend for offline development.
Maintains `AGENTS: dict[str, dict]` with static seed agents (`chemistry_kb`,
`legal_policy`, `product_faq`, `hr_policy`) and supports dynamic flow registration.

Routes:

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | Health check (no auth). |
| GET | `/api/agents` | Registry of all agent cards. |
| GET | `/agents/<id>/.well-known/agent.json` | Single agent card. |
| POST | `/agents/<id>` | A2A task endpoint (method `tasks/send` — older shape). |
| POST | `/api/flows` | Register a flow as a new agent. Persists to `flows.json`. |
| DELETE | `/api/flows/<id>` | Remove a registered flow. |

Persistence: `flows.json` saved alongside the script. `_restore_persisted_flows()`
runs at startup to rehydrate.

> The simulator uses `tasks/send` (older A2A shape), single-ID URLs, and a
> custom `/api/flows` endpoint. The production platform uses `SendMessage`,
> dual-ID URLs (discovery vs internal), and has no flow endpoint yet. Don't
> assume parity — `server.js` targets production.

---

## Complete example: end-to-end invocation

Tracing the prompt: *"Ask the LinkedIn Reviewer to review this post: 'Excited to ship a new MCP plugin!'"*

### 1. Claude reads the skill

Cowork loads `SKILL.md`. Claude sees the trigger phrase ("review", "ask the
LinkedIn Reviewer") and decides to call `phinite_invoke_agent`.

### 2. `tools/call` → server.js stdin

```json
{"jsonrpc":"2.0","id":1,"method":"tools/call",
 "params":{"name":"phinite_invoke_agent",
           "arguments":{"agentId":"YtzU43HFG",
                        "message":"Excited to ship a new MCP plugin!"}}}
```

### 3. `handle()` dispatches → `invokeAgent()` → `client.sendMessage('YtzU43HFG', '...', undefined)`

Inside `sendMessage`:

- `resolveTaskUrl('YtzU43HFG')` →
  - Cache miss → `fetchAgentCard('YtzU43HFG')`
    → `GET https://ai-core-dev.phinite.ai/a2a/YtzU43HFG/.well-known/agent-card.json`
  - Reads `supportedInterfaces[0].url` → `https://ai-core-dev.phinite.ai/a2a/agents/trmW_x2i46F8`
  - Caches it.
- No `contextId` provided → no `taskId` lookup.
- Build payload:
  ```json
  {"jsonrpc":"2.0","id":"<uuid>","method":"SendMessage",
   "params":{"message":{"role":"user","parts":[{"type":"text","text":"Excited to ship a new MCP plugin!"}]}}}
  ```
- `POST https://ai-core-dev.phinite.ai/a2a/agents/trmW_x2i46F8`

### 4. Phinite responds

```json
{"result":{"task":{"id":"6a4d...","contextId":"3ff3...",
                   "status":{"state":"TASK_STATE_INPUT_REQUIRED"},
                   "artifacts":[{"parts":[{"text":"Great start! ..."}]}]}}}
```

### 5. Plugin updates the session map

```js
_lastTaskByContext.delete('3ff3...')              // move-to-end
_lastTaskByContext.set('3ff3...', '6a4d...')
_persistSessions()                                 // writes sessions.json
```

### 6. Plugin returns to Claude

```json
{
  "taskId":    "6a4d...",
  "contextId": "3ff3...",
  "status":    "TASK_STATE_INPUT_REQUIRED",
  "answer":    "Great start! ...",
  "artifacts": [...],
  "_debug": {
    "serverVersion":    "0.3.2-persistent-sessions",
    "inboundContextId": null,
    "priorTaskIdFound": null,
    "sentTaskIdInMsg":  null,
    "mapSize":          1
  }
}
```

Claude relays the `answer` to the user.

### 7. Follow-up turn

User: *"Make it shorter and remove the emoji."*

Cowork may respawn `server.js` before this call — that's fine. The new process
boots, `loadSessions()` reads `sessions.json` and the map is rehydrated.

Claude calls `phinite_invoke_agent` again with `sessionId: "3ff3..."`. Inside
`sendMessage`:

- `_lastTaskByContext.get('3ff3...')` → `'6a4d...'` (found!)
- `message = { role:'user', parts:[...], contextId:'3ff3...', taskId:'6a4d...' }`
- POST with the same shape as before, but now with both linkage fields.

Phinite sees `contextId + taskId` together → loads prior history → produces a
real revision of the post instead of asking for it again.

The plugin updates the map (Phinite usually echoes the same `taskId` back) and
saves `sessions.json`. `_debug.priorTaskIdFound` and `_debug.sentTaskIdInMsg`
both contain `'6a4d...'`, confirming the lookup hit.
