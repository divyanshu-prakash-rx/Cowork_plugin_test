# Phinite Marketplace

A Claude (Cowork) **plugin marketplace** containing the **Phinite Agents** plugin.
This is the **remote** variant: the plugin is a thin connector that points at the
**hosted Phinite MCP server** — there is no server code in this repo, just the
connector config and skill. Authentication is **OAuth** (sign in with your
Phinite account).

```
Claude (Cowork) ──MCP over HTTPS──▶ https://webhook.dev.phinite.ai/api/v1/ai/mcp
                  OAuth (sign in to Phinite, no key pasted)
```

---

## What's in this folder

```
phinite-marketplace/
├── .claude-plugin/
│   └── marketplace.json              ← the marketplace registry (lists the plugin)
└── phinite-agents/                   ← the plugin
    ├── .claude-plugin/
    │   └── plugin.json               ← plugin identity (name, version, description)
    ├── .mcp.json                     ← the remote connector (hosted MCP URL)
    └── skills/
        └── phinite-agents/SKILL.md   ← when/how Claude uses the plugin
```

No `servers/` folder — the MCP server is **hosted inside Phinite**; this plugin
only connects to it.

---

## The config files

### `.claude-plugin/marketplace.json`
The marketplace registry. Declares the marketplace `name` (`phinite`) and lists
the plugins it offers (here, one: `phinite-agents`, with its `source` path).
This is the file Claude reads when you run `/plugin marketplace add`.

### `phinite-agents/.claude-plugin/plugin.json`
The plugin manifest — just `name`, `version`, `description`, `author`. **No
`userConfig`** and **no API-key field**: auth is OAuth, so the user signs in
rather than entering anything.

### `phinite-agents/.mcp.json`
The **remote connector** config — how Claude reaches the hosted server:

```json
{
  "mcpServers": {
    "phinite": {
      "type": "http",
      "url": "https://webhook.dev.phinite.ai/api/v1/ai/mcp"
    }
  }
}
```

- **`type: "http"`** — remote connector (not a local process).
- **`url`** — the hosted Phinite MCP endpoint (inside ai-core, public ingress).
- **No `headers`** — the server is OAuth-protected. On the first call it replies
  `401` with its OAuth metadata; Cowork runs the sign-in flow automatically and
  attaches the token on subsequent calls. Nothing to configure here.

---

## How auth works (OAuth)

Fully handled by Cowork — the user types nothing:

```
1. Cowork → MCP server (no token)
2. MCP server → 401 + .well-known/oauth-protected-resource pointer
3. Cowork discovers the auth server, self-registers (Dynamic Client Registration)
4. User signs into Phinite in the browser (PKCE) → token
5. Cowork attaches the token on every call; tokens live in the OS keychain
```

The OAuth endpoints live on the Phinite side (issuer
`https://webhook.dev.phinite.ai/api/v1/oauth/mcp`): `/authorize`, `/token`,
`/register`. The plugin needs no OAuth config — discovery does it all.

---

## What to set before publishing

Just confirm **`.mcp.json` → `url`** points at the live MCP endpoint
(`https://webhook.dev.phinite.ai/api/v1/ai/mcp`). Nothing else — no keys, no
headers, no userConfig.

> The host must be **publicly reachable** by Cowork **and** able to reach the
> Phinite backend. `webhook.dev.phinite.ai` is the public ingress to the
> in-network ai-core server, so both hold.

---

## Install (from this marketplace)

```
/plugin marketplace add <your-org>/phinite-marketplace
/plugin install phinite-agents@phinite
```

On install, the connector hits the server, gets the OAuth challenge, and Claude
prompts the user to **sign in to Phinite**. After sign-in it just works — no Node,
no files, no pasted key.

---

## Variants (for reference)

| Folder | Type | Auth | Server runs |
|--------|------|------|-------------|
| **`phinite-marketplace`** (this) | remote connector | **OAuth** | hosted (ai-core) |
| `Phinite-local` | local (stdio) | chat-paste key | user's machine |
| `Phinite_mcp_server` | standalone server source | bearer header | deploy anywhere |
