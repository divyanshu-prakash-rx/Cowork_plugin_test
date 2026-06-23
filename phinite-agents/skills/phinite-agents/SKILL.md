---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "1.1.0"
---

## Authentication

The Phinite tools authenticate via **OAuth** — the user signs into their Phinite
account when they connect the plugin. There is no key to enter and nothing to
paste in chat.

If a tool returns an auth error (`401`, "unauthorized", or a connect/sign-in
prompt), tell the user to **connect the Phinite plugin and sign in**, then retry.

## Discover agents

| Situation | Tool |
|-----------|------|
| "What agents do I have?" / you need the full list | `phinite_list_agents` |
| Find an agent for a task, ID unknown | `phinite_search_agents` |
| You have an agent ID and want its full record | `phinite_discover_agent` |

- `phinite_search_agents` — pass `query` (natural language), optional `limit`,
  optional `tags`. Prefer this for routing by capability. Use a result's `id`
  as `agentId`. If it returns nothing, fall back to `phinite_list_agents`.
- `phinite_list_agents` — no arguments; returns every live agent (`id`, `name`,
  `description`, `flowid`, `status`, `skills`, `tools`). Use `id` as `agentId`.
- `phinite_discover_agent` — pass `agentId`; returns that agent's full record.

## Invoke an agent

`phinite_invoke_agent` arguments:

| Argument | Required | Notes |
|----------|----------|-------|
| `agentId` | yes | The `id` from list/search/discover |
| `message` | yes | The user's question or task as plain text |
| `contextId` | no | The conversation thread id — pass it back to continue |
| `taskId` | no | The task id — pass it back to continue |

### How a conversation works (read carefully)

A reply may **not** include a `taskId` right away. The `taskId` is what you carry
to continue a conversation, so getting it is the goal of the opening exchange.

**1. First call** — send just `agentId` + `message` (no `contextId`/`taskId`).
The reply will include a **`contextId`**. It may or may not include a `taskId` yet.

**2. If the agent asks for credentials / authorization** — the reply will contain
a **link** (the agent needs the user to authorize or provide something), and there
will be **no `taskId`** yet. Do this:
   - Show the user the link and ask them to complete it.
   - After they confirm they're done, **invoke again with full context** — pass
     the **`contextId`** from the previous reply (and any `taskId` you have) along
     with the user's intent.
   - **Repeat** (re-invoke with the `contextId`) until the reply comes back **with
     a `taskId`**.

**3. Once you have a `taskId`** — store **both** `contextId` and `taskId`. From
then on, pass **both** on **every** call to this agent for the rest of the
conversation. This is what keeps the agent's memory.

**4. New conversation** — when the user moves to a genuinely different subject,
**omit** `contextId` and `taskId` to start fresh (then repeat from step 1).

### Quick rules
- Always send `contextId` + `taskId` together once you have them.
- Never drop the `taskId` mid-conversation — keep sending it until a new
  conversation is needed.
- If a reply has a `contextId` but no `taskId`, you're still in the opening
  exchange — continue with `contextId` until a `taskId` appears.

The reply includes: `answer`, `contextId`, `taskId` (when available), `status`
(`TASK_STATE_INPUT_REQUIRED` = open, not an error; `TASK_STATE_COMPLETED`;
`TASK_STATE_FAILED`).

## Routing rules

- Route domain questions directly to the matching agent without asking which one.
- If it's unclear which agent fits, list/search, pick the best match, then invoke.
- Relay the agent's answer faithfully; don't summarise or rewrite unless asked.
- Never answer from your own knowledge what falls within an agent's domain.

## Error handling

- `401` / connect prompt → not signed in (or session expired); tell the user to
  connect the Phinite plugin and sign in, then retry.
- `403` → signed in, but no access to that agent's workspace/org.
- Agent returns a credentials/authorization link → see Invoke step 2 above.
- `TASK_STATE_FAILED` → inform the user and offer to retry.
- Other errors → relay the code and message verbatim.
