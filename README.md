# Phinite Agents Plugin

A Claude (Cowork) plugin that exposes Phinite's **A2A (Agent-to-Agent) platform**
over MCP. Claude can list published agents, invoke them with conversation memory,
and design + publish new agent flows — all from the Cowork chat window.

```
Cowork (Claude) ──MCP stdio──▶ servers/server.js ──HTTPS──▶ https://app-dev.phinite.ai/api/v1
                                                             (registry, flows, tools — Bearer auth)
                                                  ──HTTPS──▶ https://ai-core-dev.phinite.ai
                                                             (A2A SendMessage — X-Api-Key auth)
```

> `server.js` is a thin MCP bridge — no npm dependencies, Node.js built-ins only.
> Claude talks JSON-RPC over stdio; `server.js` translates each tool call into
> the appropriate Phinite REST / A2A request.

---

## Tools exposed to Claude

| MCP tool | What it does |
|----------|--------------|
| `phinite_list_agents` | Lists every live agent in the configured workspace from the Phinite registry. Falls back to `PHINITE_AGENT_IDS` if `PHINITE_WORKSPACE_ID` is unset (offline dev). |
| `phinite_discover_agent` | Returns the full registry record for one agent ID, including `taskUrl`, skills, tools, and `flowid`. |
| `phinite_invoke_agent` | Sends a message to an agent via JSON-RPC `SendMessage`. Requires `conversationMode: "new"` or `"continue"` — session continuity is handled automatically by the plugin. |
| `phinite_create_flow` | Claude designs the whole creative blueprint (nodes, edges, prompts, tool code); this tool transforms it into the platform's storage format and PUTs it to an existing flow row. **Requires a pre-existing `flowId` from the Phinite dashboard.** |

---

## Prerequisites

| Tool | Version | Required for |
|------|---------|--------------|
| Cowork desktop app | latest | Host that loads the plugin |
| Node.js | ≥ 18 | Runs `servers/server.js` (no npm install needed) |
| `zip` / PowerShell | any | Packaging into `.plugin` |
| Python ≥ 3.9 + `flask` | latest | **Optional** — only needed for the local A2A simulator (offline dev) |

---

## Setup

### 1. Create `credentials.json`

Copy the template and fill in your secrets. This file is gitignored — your API key never touches the repo.

```bash
cp credentials.example.json credentials.json
```

Edit `credentials.json`:

```json
{
  "PHINITE_API_KEY":      "eyJ...",
  "PHINITE_WORKSPACE_ID": "aTIVxzm"
}
```

- **`PHINITE_API_KEY`** — your Phinite API key (JWT starting with `eyJ...`). Find it in the Phinite dashboard under API Keys.
- **`PHINITE_WORKSPACE_ID`** — your workspace ID. Visible in the Phinite dashboard URL (e.g. `aTIVxzm`).

> `credentials.json` is loaded automatically by `servers/lib/config.js` at startup.
> Environment variables in `.mcp.json` still win if both are set — but keep secrets
> in `credentials.json`, not `.mcp.json`, so you can safely commit `.mcp.json`.

### 2. Edit `.mcp.json` — paths only, no secrets

Cowork reads this file when it installs the plugin to learn how to launch the MCP server.
Only the **file paths** need to be updated to match your machine — no secrets go here.

```json
{
  "mcpServers": {
    "phinite": {
      "command": "node",
      "args": ["C:\\absolute\\path\\to\\Phinite Plugin\\servers\\server.js"],
      "env": {
        "PHINITE_APP_BASE_URL": "https://app-dev.phinite.ai/api/v1",
        "PHINITE_A2A_BASE_URL": "https://ai-core-dev.phinite.ai"
      }
    }
  }
}
```

> **`args[0]` must be an absolute path.** On Windows, escape backslashes (`\\`).
> `PHINITE_APP_BASE_URL` and `PHINITE_A2A_BASE_URL` are already set to the correct
> dev endpoints — only change them if you're pointing at a different environment.

### 3. Package the plugin

The zip must have all files **at its root**, not nested under a top-level directory:

```bash
# macOS / Linux
cd "Phinite Plugin"
rm -f phinite.plugin
zip -r phinite.plugin . -x "credentials.json" "servers/sessions.json" "logs/*" "*.swp" ".DS_Store"
```

```powershell
# Windows PowerShell — from inside the "Phinite Plugin" folder
Compress-Archive -Path * -DestinationPath phinite.plugin -Force
```

Correct zip structure:

```
✅ Correct                              ❌ Wrong
.claude-plugin/plugin.json              Phinite Plugin/.claude-plugin/plugin.json
.mcp.json                               Phinite Plugin/.mcp.json
servers/server.js                       Phinite Plugin/servers/server.js
credentials.example.json
```

> `credentials.json` is excluded from the zip. Each developer keeps their own local copy.

### 4. Install in Cowork

Drag and drop `phinite.plugin` into the Cowork chat window. Cowork unpacks it,
reads `.claude-plugin/plugin.json` for metadata, and reads `.mcp.json` to spawn the MCP server.

### 5. Test in chat

```
"What Phinite agents do I have access to?"      → phinite_list_agents
"Ask the LinkedIn Reviewer to review this post: ..."  → phinite_invoke_agent
"Make it shorter"                               → phinite_invoke_agent (conversationMode: continue)
"Create a customer intake flow"                 → phinite_create_flow
```

---

## Configuration

All configuration is resolved from two sources (first found wins):

1. **Environment variables** — set via `.mcp.json` `env` block.
2. **`credentials.json`** — at the plugin root (or `servers/credentials.json`, or the path in `PHINITE_CREDENTIALS_FILE`).

### Environment variables / credentials keys

| Key | Default | Purpose |
|-----|---------|---------|
| `PHINITE_API_KEY` | *(required)* | API key sent as `Authorization: Bearer` to the registry and flow endpoints, and as `X-Api-Key` to the A2A endpoint. Same key for both. |
| `PHINITE_WORKSPACE_ID` | *(required)* | Your Phinite workspace ID. Required for `phinite_list_agents`, `phinite_discover_agent`, and `phinite_create_flow`. |
| `PHINITE_APP_BASE_URL` | `https://app-dev.phinite.ai/api/v1` | REST API base URL (registry, flows, tools). |
| `PHINITE_A2A_BASE_URL` | `https://ai-core-dev.phinite.ai` | A2A JSON-RPC base URL (SendMessage). |
| `PHINITE_AGENT_IDS` | *(empty)* | Comma-separated fallback agent IDs used when `PHINITE_WORKSPACE_ID` is unset. Dev/offline only. |
| `PHINITE_SESSIONS_FILE` | `servers/sessions.json` | Disk path for the persisted `agentId → {contextId, taskId}` map. |
| `PHINITE_SESSIONS_MAX` | `500` | Max sessions kept (LRU eviction). |
| `PHINITE_CREDENTIALS_FILE` | *(auto-search)* | Override path to `credentials.json` if you store it elsewhere. |

---

## Using the tools

### List and discover agents

```
"What agents do I have?"
"Show me the LinkedIn Reviewer agent card."
```

`phinite_list_agents` queries `GET /a2a-registry?workspaceid=...` with Bearer auth and returns every live agent. Each entry includes `id` (use this as `agentId`), `name`, `description`, `flowid`, `taskUrl`, `skills`, and `tools`.

`phinite_discover_agent` returns the full record for one `agentId`.

### Invoke an agent

`phinite_invoke_agent` takes three arguments:

| Argument | Type | Required | Notes |
|----------|------|----------|-------|
| `agentId` | string | yes | The `id` from `phinite_list_agents` |
| `message` | string | yes | Plain text question or task |
| `conversationMode` | `"new"` \| `"continue"` | yes | `"new"` starts a fresh thread; `"continue"` picks up the last conversation with this agent |

You **never** pass a session token. The plugin tracks `contextId + taskId` per agent in `sessions.json` and threads them automatically when you use `"continue"`.

```
Turn 1:  "Ask the LinkedIn Reviewer to review this post: [post text]"
         → conversationMode: "new"

Turn 2:  "Make it shorter and remove the emoji"
         → conversationMode: "continue"  (plugin injects contextId + taskId automatically)
```

### Create a flow

`phinite_create_flow` is a two-role collaboration: **Claude designs, the tool packages and publishes.**

**Workflow:**

1. **Get a `flowId` first.** Before designing anything, ask: *"Please go to your Phinite dashboard, create an empty/draft flow, and paste its flow ID here."* The tool hard-errors if `flowId` is missing — it PUTs to an existing row, it cannot create rows.
2. Ask the user what the flow should do (1–2 short questions, not a survey).
3. Design the blueprint — nodes, edges, agent prompts, tools, custom Python code.
4. Show the user a summary before calling the tool on non-trivial designs.
5. Call `phinite_create_flow` with `flow` + `flowId`.
6. Report `created_tools`, `flowId`, and any `publishError`.

**Blueprint shape (what Claude passes as `flow`):**

```jsonc
{
  "name":        "Customer Intake Flow",
  "description": "Triages incoming inquiries and routes to the right team.",
  "nodes": [
    { "id": "start", "task": "Start" },
    { "id": "intake-agent", "task": "Process customer inquiry", "type": "task" },
    { "id": "child-sentiment", "task": "Analyse sentiment", "type": "child" },
    { "id": "end", "task": "End" }
  ],
  "edges": [
    ["start",          "intake-agent",  "new_inquiry_received"],
    ["child-sentiment","intake-agent",  "sentiment_analysis"],
    ["intake-agent",   "end",           "request_completed"]
  ],
  "blocks": [
    {
      "id": "intake-agent",
      "name": "Customer Intake Agent",
      "agent_prompt": "... detailed prompt ...",
      "input_variables": ["raw_message"],
      "capture_variables": {
        "customer_email": "The customer's email. Validate format.",
        "service_type":   "One of: billing, technical, sales, other."
      },
      "predefined_tools": [
        {
          "name": "firecrawl",
          "operation": "scrape",
          "description": "Scrape a URL for context",
          "inputs":  { "firecrawl.scrape.url": { "type": "string", "description": "URL" } },
          "outputs": ["firecrawl.scrape.output.html"]
        }
      ],
      "custom_tools": [
        {
          "name": "log_inquiry",
          "description": "Persist inquiry to CRM.",
          "code": "def main(inputs, env_variables):\n    return {'output': {}, 'capture_variables': {}}"
        }
      ]
    },
    {
      "id": "child-sentiment",
      "name": "Sentiment Analyzer",
      "agent_prompt": "... child prompt ...",
      "input_variables": ["raw_message"],
      "capture_variables": { "sentiment_score": "Float -1.0 to 1.0" },
      "llm_tool_description": "Analyses message sentiment.",
      "resource":  "text",
      "operation": "analysis"
    }
  ]
}
```

**What the tool does with the blueprint:**

1. For each block's `custom_tools`: `POST /tool` to create, then `PUT /tool/{id}` with base64-encoded Python source.
2. Looks up the flow's own `assistantid` from `GET /flow_V2?flowid=<id>` and uses that (not the user-supplied one) to scope custom tools correctly.
3. Transforms the blueprint into React Flow node positions, edge objects, and `blocks_content` via `lib/flow-builder.js`.
4. `PUT /flow_V2/update/{flowId}` with the assembled payload.

---

## How session memory works

Phinite's `SendMessage` only loads history when **both** `contextId` and the prior
`taskId` are inside the request `message`. The plugin handles this transparently:

1. After every `phinite_invoke_agent` response, `SessionStore` saves `agentId → {contextId, taskId}` to `sessions.json`.
2. On the next call with `conversationMode: "continue"`, the stored values are injected into `message` automatically.
3. Because Cowork respawns the MCP process between user turns, `sessions.json` **must** persist on disk — in-memory alone is wiped every turn.
4. Sessions are keyed by **agentId**, not contextId, so Claude only needs to pass the agent ID and pick `"continue"`.

The `_debug` field on every `phinite_invoke_agent` response confirms what happened:

```json
"_debug": {
  "serverVersion":  "0.4.3-credentials-file",
  "agentId":        "YtzU43HFG",
  "continued":      true,
  "priorContextId": "3ff3...",
  "priorTaskId":    "6a4d...",
  "mapSize":        7
}
```

---

## Rebuilding and reinstalling

Every code change requires re-packaging and reinstalling. Cowork uses its installed
copy, not the source folder.

1. Bump `SERVER_VERSION` in `servers/lib/config.js`.
2. Repackage: `rm -f phinite.plugin && zip -r phinite.plugin . -x "credentials.json" "servers/sessions.json" ...`
3. In Cowork: uninstall the old plugin version.
4. **Quit Cowork from the system tray** (closing the window isn't enough — the process stays alive).
5. Reopen Cowork. Drag in the new `phinite.plugin`.
6. Confirm via `phinite_invoke_agent` — `_debug.serverVersion` should match what you bumped.

If `_debug` is missing or the version is stale, Cowork is still running the old copy. Repeat with a more aggressive uninstall.

---

## Plugin file reference

```
Phinite Plugin/
├── .claude-plugin/
│   └── plugin.json          Plugin identity, version, Cowork settings panel
├── .mcp.json                How Cowork spawns the MCP server (paths + env — no secrets)
├── credentials.example.json Template — copy to credentials.json and fill in
├── credentials.json         (gitignored) Your API key + workspace ID
├── skills/
│   └── phinite-agents/
│       └── SKILL.md         Claude's runtime instructions: when and how to use each tool
├── hooks/
│   ├── hooks.json           Post-tool-call hook config
│   └── scripts/
│       └── log-api-call.sh  Appends each tool call to logs/api-calls.log
└── servers/
    ├── server.js            MCP stdio dispatcher — thin, no business logic
    ├── sessions.json        (gitignored, runtime) persisted agentId→{contextId,taskId} map
    ├── lib/
    │   ├── config.js        Env-var + credentials.json resolution; SERVER_VERSION
    │   ├── http-client.js   Base HTTP helper (no npm deps); HttpError class
    │   ├── sessions.js      SessionStore — disk-persisted Map<agentId, {contextId,taskId}>
    │   ├── registry-client.js  PhiniteRegistryClient — GET /a2a-registry (Bearer auth)
    │   ├── a2a-client.js    PhiniteA2AClient — SendMessage (X-Api-Key auth)
    │   └── flow-builder.js  Blueprint → platform JSON transform (node layout, edges, blocks)
    └── tools/
        ├── list-agents.js   phinite_list_agents
        ├── discover-agent.js  phinite_discover_agent
        ├── invoke-agent.js  phinite_invoke_agent
        └── create-flow.js   phinite_create_flow
```

To add a new tool: drop a file in `servers/tools/` exporting `{ schema, handler }`, then add it to the `tools` array in `servers/server.js`. No other changes needed.

---

## Optional — local A2A simulator

A Flask simulator lives at `Extra/Openclaw_External/simulator/phinite_A2A.py` for
offline development. It is **not** needed for normal use.

```bash
pip install flask
python "Extra/Openclaw_External/simulator/phinite_A2A.py"
# Dashboard: http://localhost:3001
```

> The simulator uses an older protocol shape (`tasks/send`, single-ID URLs).
> The real platform uses `SendMessage` and dual-ID URLs. The plugin targets the
> production shape — don't assume the simulator and plugin are in sync.

---

## Production / Marketplace Deployment

### Approach 1 — host `server.js` as HTTP

Wrap `handle()` in an HTTP server and deploy it. Switch `.mcp.json` to HTTP mode:

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

Users only need to enter their API key in Cowork's settings panel.

### Approach 2 — embed MCP directly in the Phinite backend (recommended)

If the Phinite API itself implements MCP's HTTP endpoint, `server.js` disappears.
The backend handles `POST /mcp → { initialize, tools/list, tools/call }` and calls
its own internal logic directly. One service instead of two.

### Stdio vs HTTP comparison

|                       | Local (stdio)         | Marketplace (http)        |
|-----------------------|-----------------------|---------------------------|
| MCP server runs on    | User's machine        | Your server               |
| Requires Node.js      | Yes                   | No                        |
| Auth                  | `credentials.json`    | Bearer header             |
| User setup            | Edit paths in `.mcp.json` | Enter API key in Cowork |
| Works in marketplace  | No                    | Yes                       |
| Best for              | Development & testing | Production & distribution |

---

## A2A Protocol Reference

What the plugin actually sends to the Phinite backend.

### Agent registry lookup

```
GET https://app-dev.phinite.ai/api/v1/a2a-registry
    ?workspaceid=aTIVxzm&pagination=true&page=1&limit=50&status=live
Authorization: Bearer <PHINITE_API_KEY>
```

Returns `{ data: [ { a2aregistryid, agent_card, flowid, assistantid, status, tools, ... }, ... ] }`.

The `a2aregistryid` is the canonical agent ID used everywhere else.

### Send a message (turn 1 — `conversationMode: "new"`)

```
POST https://ai-core-dev.phinite.ai/a2a/agents/<a2aregistryid>
Content-Type: application/json
X-Api-Key: <PHINITE_API_KEY>

{
  "jsonrpc": "2.0",
  "id": "<uuid>",
  "method": "SendMessage",
  "params": {
    "message": {
      "role":  "user",
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

### Continue the conversation (turn 2+ — `conversationMode: "continue"`)

**Both** `contextId` and the prior `taskId` must be inside `message`:

```json
{
  "jsonrpc": "2.0", "id": "<uuid>", "method": "SendMessage",
  "params": {
    "message": {
      "role":      "user",
      "parts":     [{ "type": "text", "text": "follow-up" }],
      "contextId": "<from turn 1>",
      "taskId":    "<from turn 1>"
    }
  }
}
```

The plugin's `SessionStore` handles this automatically. Claude only needs to pass `conversationMode: "continue"`.

### Task statuses

| Status | Meaning |
|--------|---------|
| `TASK_STATE_INPUT_REQUIRED` | Conversation is open — agent expects more input. **Not an error.** |
| `TASK_STATE_COMPLETED` | Terminal — agent considers the task done. |
| `TASK_STATE_FAILED` | Terminal — something went wrong. |

### Flow creation endpoints

```
GET  https://app-dev.phinite.ai/api/v1/flow_V2?flowid=<id>
     Authorization: Bearer <key>
     → returns flow row including assistantid, workspaceid

POST https://app-dev.phinite.ai/api/v1/tool
     Authorization: Bearer <key>
     Body: { workspaceid, assistantid: [<id>], name }
     → returns { toolid, ... }

PUT  https://app-dev.phinite.ai/api/v1/tool/<toolId>
     Authorization: Bearer <key>
     Body: { description, api_code: "<base64 python>", is_encoded: true }

PUT  https://app-dev.phinite.ai/api/v1/flow_V2/update/<flowId>
     Authorization: Bearer <key>
     Body: { name, description, nodes, edges, blocks_content }
```

---

## Technical Reference

### `servers/lib/config.js`

Central config — all other modules import from here, never from `process.env` directly.

**`loadCredentialsFile()`** — searches for `credentials.json` in order: `PHINITE_CREDENTIALS_FILE` env var → `<plugin root>/credentials.json` → `servers/credentials.json`. Parses the JSON object and returns `{ values, source }`.

**`pick(key, fallback)`** — `process.env[key]` wins if non-empty; otherwise falls back to `credentials.values[key]`; then `fallback`.

**Exports:** `SERVER_VERSION`, `API_KEY`, `WORKSPACE_ID`, `APP_BASE_URL`, `A2A_BASE_URL`, `FALLBACK_AGENT_IDS`, `SESSIONS_FILE`, `SESSIONS_MAX`, `CREDENTIALS_SOURCE`.

---

### `servers/lib/http-client.js`

**`request(method, urlOrPath, { baseUrl, body, headers })`** — base HTTP helper. Accepts a full URL or a path relative to `baseUrl`. Always sets `Content-Type: application/json`. Throws `HttpError` (carries `.status`) on non-2xx.

No npm dependencies — uses Node.js `https`/`http` built-ins.

---

### `servers/lib/sessions.js`

**`SessionStore`** — disk-persisted `Map<agentId, { contextId, taskId }>`.

| Method | Purpose |
|--------|---------|
| `get(agentId)` | Returns `{ contextId, taskId }` or `undefined`. |
| `set(agentId, contextId, taskId)` | Upserts and persists to disk (LRU eviction at `SESSIONS_MAX`). |
| `clear(agentId)` | Removes one session. |
| `size` | Current map size. |

Atomic write: writes to `.tmp` then `rename` so a crash mid-write never leaves a corrupt file. Keyed by `agentId` (not `contextId`) so `sendMessage` only needs the agent ID to continue.

---

### `servers/lib/registry-client.js`

**`PhiniteRegistryClient`**

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `listAgents({ status, limit, page, extra })` | `GET /a2a-registry?workspaceid=...` | Lists agents. Defaults to `status=live, limit=50`. |
| `getAgent(a2aregistryid)` | `GET /a2a-registry?workspaceid=...&a2aregistryid=...` | Single-row lookup. Returns `null` if not found. |
| `_normalize(row)` | — | Maps raw registry row to `{ id, a2aregistryid, flowid, assistantid, taskUrl, name, description, skills, tools, ... }`. |

Auth: `Authorization: Bearer <API_KEY>`. Throws if `API_KEY` or `WORKSPACE_ID` is unset.

---

### `servers/lib/a2a-client.js`

**`PhiniteA2AClient({ sessionStore, registryClient })`**

| Method | Purpose |
|--------|---------|
| `resolveTaskUrl(agentId)` | Builds `<A2A_BASE_URL>/a2a/agents/<agentId>` deterministically. Cached per-process. |
| `fetchWellKnownCard(agentId)` | `GET /a2a/<id>/.well-known/agent-card.json`. |
| `sendMessage(agentId, text, { conversationMode })` | Core method — see below. |
| `_authHeaders()` | Returns `{ "X-Api-Key": <API_KEY> }`. |
| `_extractAnswer(artifacts)` | Flattens all `parts[i].text` from all artifacts into one `\n\n`-joined string. |

**`sendMessage` flow:**

1. `resolveTaskUrl(agentId)` → POST target.
2. Build `message = { role: "user", parts: [...] }`.
3. If `conversationMode === "continue"`: look up `sessions.get(agentId)` → inject `message.contextId` and `message.taskId` if found.
4. POST `{ jsonrpc, id: uuid, method: "SendMessage", params: { message } }` with `X-Api-Key` header.
5. On success: `sessions.set(agentId, task.contextId, task.id)` → persists to disk.
6. Returns `{ taskId, contextId, status, answer, artifacts, continued, _debug }`.

The `_debug` field shows `serverVersion`, `agentId`, `continued`, `priorContextId`, `priorTaskId`, `mapSize` — use it to diagnose session issues.

---

### `servers/lib/flow-builder.js`

Pure transform — no HTTP calls, no side effects.

| Function | Purpose |
|----------|---------|
| `buildNodes(blueprintNodes)` | Assigns React Flow `position` to each node. `start` top-center, `end` bottom-center, `task` nodes in a vertical column, `child` nodes offset right of their parent. |
| `buildEdges(blueprintEdges, builtNodes)` | Maps `[source, target, label]` triples to React Flow edge objects. Edges to/from child nodes get `bidirectionalArrows: true`. |
| `buildPredefinedToolBlock(toolRef)` | Converts a predefined tool reference into `predefined_tool_entry + capture_variables`. |
| `buildBlockContent(block, { workspaceId, nodeType })` | Assembles the full `blocks_content` entry: `orchestration_model`, `capture_variables`, `input_variables`, tool entries, `custom_tool_ids`. |
| `buildFlowPayload(blueprint, { workspaceId })` | Top-level entry point. Returns `{ name, description, nodes, edges, blocks_content }` ready to PUT. |

---

### `servers/tools/create-flow.js`

**`fetchFlow({ flowId, apiKey })`** — `GET /flow_V2?flowid=<id>`. Extracts the flow's `assistantid` and `workspaceid`. Returns `null` on 404.

**`createCustomTool({ name, description, code, workspaceId, assistantId, apiKey })`**

1. `POST /tool` with `{ workspaceid, assistantid: [assistantId], name }` → gets `toolid`.
2. On duplicate-name error (400/409): appends a random suffix and retries (up to 3 attempts).
3. `PUT /tool/{toolId}` with `{ description, api_code: base64(code), is_encoded: true }`.
4. Returns `{ id: toolId, name: toolName }`.

**Handler flow:**

1. Validates `flowId` present (hard-errors if missing with a message telling Claude to ask the user).
2. Validates `workspaceId` present.
3. `fetchFlow` → overrides `assistantId` and `workspaceId` with the flow's own values (prevents assistant-scope mismatch).
4. For each block's `custom_tools`: calls `createCustomTool`, pushes resulting ID to `block.custom_tool_ids`.
5. `buildFlowPayload(flow, { workspaceId })`.
6. `PUT /flow_V2/update/{flowId}`.
7. Returns `{ created_tools, payload, flowId, published, publishError, assistantId_used, workspaceId_used, overrides_applied, note }`.

---

### `servers/server.js`

Thin dispatcher — builds shared clients, loads tools array, handles MCP framing.

**Startup:** constructs `SessionStore`, `PhiniteRegistryClient`, `PhiniteA2AClient`, assembles `ctx = { registry, a2a, sessions, cfg }`, logs boot line to stderr.

**`send(msg)`** — writes `JSON.stringify(msg) + '\n'` to stdout (NDJSON, not LSP Content-Length).

**`handle(msg)`** — routes inbound JSON-RPC:

| `msg.method` | Action |
|---|---|
| `initialize` | Returns `protocolVersion`, `capabilities`, `serverInfo`. |
| `notifications/*`, `initialized` | Silently ignored. |
| `tools/list` | Returns `{ tools: tools.map(t => t.schema) }`. |
| `tools/call` | Finds tool by `name`, calls `tool.handler(args, ctx)`, wraps result as MCP `content`. Errors return `isError: true`. |
| anything else | `-32601 Method not found`. |

**stdin reader:** accumulates chunks, splits on `\n`, strips `\r`, parses JSON, dispatches through `handle()`. Parse errors are silently dropped. Runtime errors in `handle()` send a `-32603` response if the message had an `id`.

---

## Troubleshooting

| Symptom | Root cause | Fix |
|---------|------------|-----|
| Plugin installed but no tools appear | MCP server failed to spawn | Verify `args[0]` in `.mcp.json` is an absolute path that exists; check Node ≥ 18 with `node --version` |
| Tool calls hang or return nothing | Wrong MCP framing | If you forked `server.js`, ensure it writes NDJSON (`\n`-delimited), not LSP `Content-Length` headers |
| `_debug` field missing from invoke responses | Cowork loaded an old `server.js` | Uninstall plugin, quit Cowork from system tray, reinstall |
| Follow-up forgets context (`continued: false`) | `sessions.json` not persisting — directory unwritable or wrong path | Check `PHINITE_SESSIONS_FILE`; ensure the directory is writable; inspect `servers/sessions.json` directly |
| Follow-up sends correct IDs but agent still forgets | Phinite-side memory not enabled on the agent | Server-side fix needed on the Phinite platform |
| `phinite_create_flow` error: "flowId is required" | Claude tried to create a flow without asking for the flow ID first | Ask user for empty/draft flow ID from Phinite dashboard; see SKILL.md workflow |
| `phinite_create_flow` error: "Flow '...' not found" | Wrong or stale flow ID | Verify the flow ID exists in the Phinite dashboard; create a new empty flow if needed |
| `phinite_create_flow` error: "Tool created but no toolid" | POST /tool response shape changed | Check raw response in the `publishError` field; report to Phinite team |
| `401 Unauthorized` | `PHINITE_API_KEY` missing or wrong | Check `credentials.json` exists and contains the correct key; or set `PHINITE_API_KEY` in `.mcp.json` env |
| `403 Forbidden` | API key valid but no access to this resource | Confirm `PHINITE_WORKSPACE_ID` matches the workspace that owns the agent/flow |
| `ECONNREFUSED` / `ENOTFOUND` | Wrong base URL or network issue | Check `PHINITE_APP_BASE_URL` and `PHINITE_A2A_BASE_URL` in `.mcp.json` |
| `workspaceId is required` error | `PHINITE_WORKSPACE_ID` not set | Add it to `credentials.json` or `.mcp.json` env |
| Edited `.mcp.json` but Cowork uses old values | Cowork's installed copy is independent of your source folder | Rezip and reinstall, or edit the installed copy via *Customize → Phinite agents → Connectors → Edit* |

For the full story of every issue we hit during development and why each fix looks the way it does, see [DEBUGGING.md](DEBUGGING.md).
