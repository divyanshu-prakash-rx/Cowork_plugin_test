---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "2.0.0"
---

## Authentication

The Phinite tools authenticate via **OAuth** — the user signs into their Phinite
account when they connect the plugin. There is no key to enter and nothing to
paste in chat.

If a tool returns an auth error (`401`, "unauthorized", or a connect/sign-in
prompt), tell the user to **connect the Phinite plugin and sign in**, then retry.

## Tools

The plugin exposes three tools:

| Tool | Use it to |
|------|-----------|
| `discover_agents` | Find agents matching what the user needs (natural-language search). |
| `list_agents` | List every published agent in the workspace. |
| `call_agent` | Send a message to an agent and get its reply. |

## Finding the right agent

- **`discover_agents`** — preferred for routing. Arguments:
  - `query` — natural-language description of what's needed (matched against agent
    name, description, and skills).
  - `status` (optional) — registry status filter, e.g. `LIVE`, `TEST`.
  - `limit` (optional) — max results (default 5).
- **`list_agents`** — no arguments; returns every published agent in the workspace.

Both return agent summaries with **`registry_id`**, `name`, `description`,
`skills`, `status`, `flow_id`. Use the **`registry_id`** as the agent identifier
for `call_agent`. If `discover_agents` returns nothing relevant, fall back to
`list_agents`.

## Talking to an agent — `call_agent`

Arguments:

| Argument | Required | Notes |
|----------|----------|-------|
| `registry_id` | yes | The agent's id from `discover_agents` / `list_agents` |
| `message` | yes | The user's question or task as plain text |
| `task_id` | no | The task id from a previous reply — pass it back to continue |

The reply is **text**. When the agent has started a task, the text ends with a
block like:

```
task_id: <id>
context_id: <id>
state: <TASK_STATE_...>
Pass task_id on the next call_agent to continue this conversation.
```

`task_id` is what keeps the conversation going. Getting it is the goal of the
opening exchange.

### How a conversation works (read carefully)

**1. First call** — send `registry_id` + `message` (no `task_id`). Read the reply.

**2. If the agent needs credentials / setup** — the reply will say it requires
credential setup and include a **link** (e.g. *"Open this link to connect tools
and save config: …"*), and there will be **no `task_id`** yet. Do this:
   - Show the user the link and ask them to complete it.
   - After they confirm they're done, **call `call_agent` again with the same
     `registry_id` and `message`**.
   - **Repeat** until the reply comes back **with a `task_id`**.

**3. Once you have a `task_id`** — pass it as `task_id` on **every** subsequent
`call_agent` to that agent for the rest of the conversation. Never drop it
mid-conversation; that's what keeps the agent's memory.

**4. New conversation** — when the user moves to a genuinely different subject,
**omit** `task_id` to start fresh (then repeat from step 1).

> Only `task_id` is passed back to continue — `call_agent` has no `context_id`
> argument (the server tracks context internally).

## Routing rules

- Route domain questions directly to the matching agent without asking which one.
- If it's unclear which agent fits, `discover_agents` (or `list_agents`), pick the
  best match by `registry_id`, then `call_agent`.
- Relay the agent's answer faithfully; don't summarise or rewrite unless asked.
- Never answer from your own knowledge what falls within an agent's domain.

## Error handling

- `401` / connect prompt → not signed in (or session expired); tell the user to
  connect the Phinite plugin and sign in, then retry.
- Agent reply asks for credential setup with a link → see "Talking to an agent"
  step 2 (user completes the link, then re-call until a `task_id` appears).
- Reply marked failed (`TASK_STATE_FAILED` / `TASK_STATE_REJECTED`) → inform the
  user and offer to retry.
- `Unknown registry` / `registry_id and message are required` → you passed a bad
  or missing `registry_id`; re-check it against `list_agents` / `discover_agents`.
- Other errors → relay the message verbatim.
