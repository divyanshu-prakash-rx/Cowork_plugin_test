---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "1.0.0"
---

## Authentication (OAuth)

The Phinite tools authenticate via **OAuth** — the user signs into their Phinite
account when they connect the plugin. There is **no API key to enter** and nothing
to paste in chat; Cowork handles the sign-in and token automatically.

**If a Phinite tool returns an auth error** (e.g. `401`, "unauthorized", or a
sign-in/connect prompt), tell the user:

> *"Please connect the Phinite plugin and sign in to your Phinite account, then
> try again."*

Never ask the user to paste an API key, workspace ID, or organization ID — sign-in
provides all of that.

## Using Phinite Agent Graphs

### Discover available agents

**Three tools — pick by situation:**

| Situation | Tool |
|-----------|------|
| User asks "what agents do I have?" or you genuinely need the full list | `phinite_list_agents` |
| User wants an agent for a specific task and you don't know the ID | `phinite_search_agents` |
| You already have an agent ID and want its full record | `phinite_discover_agent` |

**Prefer `phinite_search_agents` for routing.** When a user asks to do something
that an agent might handle ("review this post", "analyse this data"), search by
the capability rather than listing everything and scanning. Pass:

- `query` — natural language describing the capability (e.g. `"review linkedin posts"`)
- `limit` (optional) — max results, defaults to 5
- `tags` (optional) — filter by tags

Each result is an agent record; use its `id` as `agentId` for
`phinite_invoke_agent`. If search returns nothing relevant, fall back to
`phinite_list_agents`.

**`phinite_list_agents`** (no arguments) returns every live agent in the
workspace. Each entry has:

- `id` — the discovery ID (`a2aregistryid`) used to invoke the agent
- `name` — human-readable name
- `description` — what the agent does
- `flowid` — the underlying flow ID
- `status` — usually `"live"`
- `skills`, `tools`, `tool_config` — capabilities and attached tools

For one agent's full record (including `taskUrl`), call `phinite_discover_agent`
with that `id`.

### Invoke an agent

Call `phinite_invoke_agent` with:

| Argument | Type | Notes |
|----------|------|-------|
| `agentId` | string | The `id` from `phinite_list_agents` |
| `message` | string | The user's question or task as plain text |
| `contextId` | string (optional) | To CONTINUE a conversation, pass the `contextId` from this agent's previous reply. Omit to start fresh. |
| `taskId` | string (optional) | To CONTINUE a conversation, pass the `taskId` from this agent's previous reply. Send together with `contextId`. |

**Conversation continuity is carried by you, not the server.** Every reply
returns a `contextId` and a `taskId`. Remember them.

- **New conversation** (first call, or a different subject) → omit `contextId`/`taskId`.
- **Continue** (follow-up like "make it shorter", "now revise it", "explain that") → pass back BOTH the `contextId` and `taskId` from this agent's previous reply.

The platform needs **both** IDs to load prior history. If you don't pass them, it
simply starts a fresh conversation.

The response includes:

- `answer` — the agent's reply text
- `contextId`, `taskId` — **pass these back** to continue this conversation
- `status` — e.g. `TASK_STATE_INPUT_REQUIRED` (conversation open — not an error), `TASK_STATE_COMPLETED`, `TASK_STATE_FAILED`
- `continued` — `true` if you passed IDs in to continue

### Routing rules

- For domain-specific questions matching an agent's description, route directly to that agent without asking the user which one.
- If it's unclear which agent fits, call `phinite_list_agents`, pick the best match, then invoke.
- Relay the agent's answer faithfully. Don't summarise or rewrite unless the user asks.
- Never answer from your own knowledge questions that fall within a Phinite agent's domain — always route to the agent.

### Error handling

- `401 Unauthorized` / sign-in prompt → not signed in (or the session expired); tell the user to connect the Phinite plugin and sign in (see "Authentication" above). Never ask them to paste a key in chat.
- `403 Forbidden` → signed in, but no access to that agent's workspace/org.
- A2A errors → relay the code and message verbatim.
- `TASK_STATE_FAILED` → inform the user and offer to retry.
