# Phinite Agents

Connect Claude to the Phinite platform — discover and invoke your published
agents directly from chat. This plugin is a **thin remote connector**: it points
at the hosted Phinite MCP server and ships only the connector config + skill. No
Node.js, no local server, no files to manage.

```
Claude ──MCP over HTTPS──▶ https://mcp.phinite.ai  (hosted Phinite MCP server)
         Authorization: Bearer <your Phinite API key>
```

## Install

```
/plugin marketplace add <your-org>/phinite-marketplace
/plugin install phinite-agents@phinite
```

On install you'll be asked for **one** value — your **Phinite API Key** (from the
Phinite dashboard → API Keys, starts with `eyJ`). It's stored securely in your
system keychain and sent automatically with every request. Your workspace and
organization are read from the key — nothing else to configure.

## Use it

```
"What Phinite agents do I have?"              → lists your agents
"Find an agent that reviews LinkedIn posts"   → semantic search
"Ask <agent> to review this: ..."             → invokes the agent
"Make it shorter"                             → follow-up (same conversation)
```

## Tools

| Tool | What it does |
|------|--------------|
| `phinite_list_agents` | List every live agent in your workspace. |
| `phinite_search_agents` | Find an agent by a natural-language query. |
| `phinite_discover_agent` | Get the full record for one agent. |
| `phinite_invoke_agent` | Send a message to an agent and get its reply, with memory. |

## Updating the server URL

This plugin's `.mcp.json` points at `https://mcp.phinite.ai`. If you host the MCP
server elsewhere, change the `url` there. The server code is the Phinite MCP
server (run with `PHINITE_HTTP_PORT` set); see that project's `Mcp.md` for the
deployment reference.

---

*Auth model: the API key is sent as `Authorization: Bearer` on every request and
never appears in chat. The server derives your workspace + org from the key's
JWT. For the full server reference, see `Mcp.md` in the Phinite MCP server repo.*
