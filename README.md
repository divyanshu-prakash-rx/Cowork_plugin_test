# Phinite Marketplace

A Claude (Cowork) **plugin marketplace** containing the **Phinite Agents** plugin.
This is the **remote** variant: the plugin is a thin connector that points at a
**hosted Phinite MCP server** — there is no server code in this repo, just the
connector config and skill.

```
Claude (Cowork) ──MCP over HTTPS──▶ hosted Phinite MCP server
                  Authorization: Bearer <your Phinite API key>
```

---

## What's in this folder

```
phinite-marketplace/
├── .claude-plugin/
│   └── marketplace.json              ← the marketplace registry (lists the plugin)
└── phinite-agents/                   ← the plugin
    ├── .claude-plugin/
    │   └── plugin.json               ← plugin identity + the API-key setting (userConfig)
    ├── .mcp.json                     ← the remote connector (hosted URL + auth header)
    └── skills/
        └── phinite-agents/SKILL.md   ← when/how Claude uses the plugin
```

No `servers/` folder — the MCP server is **hosted elsewhere**; this plugin only
connects to it.

---

## The config files

### `.claude-plugin/marketplace.json`
The marketplace registry. Declares the marketplace `name` (`phinite`) and lists
the plugins it offers (here, one: `phinite-agents`, with its `source` path).
This is the file Claude reads when you run `/plugin marketplace add`.

### `phinite-agents/.claude-plugin/plugin.json`
The plugin manifest — `name`, `version`, `description`, and the **`userConfig`**
block. `userConfig` declares the single value the user is prompted for on install:

| Field | Purpose |
|-------|---------|
| `phinite_api_key` | The user's Phinite API key (JWT, `eyJ...`). `sensitive: true` → stored in the **system keychain**, never in chat. `required: true`. Workspace + org are derived from the key, so it's the only input. |

### `phinite-agents/.mcp.json`
The **remote connector** config. Tells Claude how to reach the hosted server:

```json
{
  "mcpServers": {
    "phinite": {
      "type": "http",
      "url": "https://<your-hosted-mcp-url>",
      "headers": {
        "Authorization": "Bearer ${user_config.phinite_api_key}"
      }
    }
  }
}
```

- **`type: "http"`** — remote connector (not a local process).
- **`url`** — the hosted Phinite MCP server. **Change this** to your deployed URL.
- **`headers`** — Claude injects the user's API key (from `userConfig`) as the
  bearer token on every request. `${user_config.phinite_api_key}` is substituted
  at runtime.

---

## What to set before publishing

1. **`.mcp.json` → `url`** — point it at your deployed MCP server's public URL.
2. Nothing else — the API key comes from each user at install time via `userConfig`.

> The hosted server must be **publicly reachable** by Cowork **and** able to reach
> the Phinite backend. Auth is the user's API key via the bearer header (or OAuth,
> if the header path isn't honored — see the server repo's `oauth-reference.js`).

---

## Install (from this marketplace)

```
/plugin marketplace add <your-org>/phinite-marketplace
/plugin install phinite-agents@phinite
```

On install, Claude prompts for the **Phinite API Key** (stored in the keychain)
and connects to the hosted server. No Node.js, no local files.

---

## Variants (for reference)

| Folder | Type | Server runs |
|--------|------|-------------|
| **`phinite-marketplace`** (this) | remote connector | on a hosted server |
| `Phinite-local` | local (stdio) | on the user's machine |
| `Phinite_mcp_server` | the hosted server's source | deploy this; point the `url` above at it |
