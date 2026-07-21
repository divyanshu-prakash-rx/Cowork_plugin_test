---
name: phinite-agents
description: >
  Use this skill when the user asks to run, invoke, or talk to a Phinite agent;
  asks "what agents do I have", "what agents are available", "list Phinite agents",
  "find an agent that can do X", "ask Phinite", or routes a domain-specific
  question to a specialized AI agent on the Phinite platform.
metadata:
  version: "2.1.0"
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
- Relay the agent's answer faithfully; don't summarise or rewrite unless asked —
  see **Presenting the answer** for how to present it.
- Never answer from your own knowledge what falls within an agent's domain.

## Presenting the answer

Agent replies arrive as **plain text**. Decide whether that text is better *read*
or better *seen* — and when it's better seen, build it.

> **The rule:** render UI when the reply has **structure that plain text
> flattens**. Stay in text when the reply **is** prose.

Render when the reply contains any of:

| In the reply | Render |
|---|---|
| 3+ comparable items with 2+ attributes each (products, listings, results, offers) | **Card grid** |
| One record with many fields | **Detail card** |
| A request for 2+ pieces of information from the user | **Form** |
| Line items, amounts, tax, totals, an order or bill | **Invoice / receipt** |
| Metrics, series, breakdowns — anything countable worth comparing | **KPI tiles + table + chart** |
| 2+ options weighed on the same attributes | **Comparison table** |
| A process with stages, or order/ticket status | **Stepper / timeline** |
| Dated or timed entries (itinerary, schedule, slots) | **Schedule** |

Stay in **plain text** for: a direct answer, a confirmation, a single fact, a
yes/no, one clarifying question, an error, or a couple of sentences of
explanation. **Never wrap a one-line answer in a UI** — that is slower and worse.

### Never invent data

The UI shows **only what the agent actually returned**.

- Never add prices, ratings, images, dates, rows, or "sample" values.
- A field missing from the reply is **left out of the layout** — no placeholders,
  no empty states, no `N/A` padding.
- **Use the image URLs the agent returns.** Render them (product photos,
  thumbnails, avatars) — they carry real meaning. Never invent an image URL or
  substitute stock imagery for a missing one.
- Build so a card still reads if an image fails to load (some viewers block
  remote images): a fixed aspect-ratio slot, real `alt` text, and hide the slot
  on error so the layout stays clean instead of showing a broken icon.
- Show the totals the agent gave. Only compute a sum when every component is
  present, and never silently "correct" the agent's arithmetic.

### Keep it fast

- **Lead with the answer** — one or two lines in chat, then the artifact.
- **One artifact per reply.** Never several.
- Self-contained: inline CSS/JS, no CDNs, no frameworks, no build step.
- Charts are **hand-written inline SVG** — no chart libraries.
- On a follow-up, **update the existing artifact** instead of making a new one.

Before building, read **`references/ui-patterns.md`** (next to this file) for the
design tokens, component anatomy, and markup skeletons.

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
