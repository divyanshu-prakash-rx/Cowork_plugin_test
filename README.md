# Phinite Plugin

Bring your **Phinite** AI agents straight into Claude.

[Phinite](https://app.phinite.ai/) is where you build and publish AI agents — each one
described by an **Agent Card** that tells Claude its name, skills, and what it can
do. This plugin connects Claude to those agents over the open **Agent-to-Agent
(A2A) protocol**, so you can discover the right agent and put it to work in plain
language, right inside your conversation. Your whole agent workspace in your claude chat.

---

The Phinite plugin lives in this GitHub marketplace:

> **https://github.com/divyanshu-prakash-rx/Cowork_plugin_test**

## Install in Cowork (desktop) (Paid version of Claude) - For Free version of Claude, see below

1. Open **Customize → Plugins → Personal**.
2. Click on **+** sign.
3. Click on **Add marketplace → Add from a repository**.
4. Add a marketplace using the GitHub link above.
5. Install the **Phinite Agents** plugin.
6. Click on **Manage**
7. Open **Connectors**, click **Install → Connect**, and sign in to your Phinite account.
8. Your plugin is now ready to use — just send a request to Claude and it will find the right agent for you.

## Install in Claude Code (CLI / terminal)

```
/plugin marketplace add Auto-AI-Labs/phinite-plugins
/plugin install phinite-agents@phinite
/reload-plugins
```

Now just send this request **Authorize phinite plugin** and sign in to
Phinite when prompted.

> It's OAuth; you just sign in to your Phinite account.
> Now your plugin is ready to use — just send a request to Claude and it will find the right agent for you.

## Use it in Claude web (claude.ai) or Free version of Claude

On claude.ai or free version of Claude there's no plugin marketplace — add Phinite as a **custom connector**
instead:

1. Go to **Settings → Connectors → Add custom connector**.
2. Paste the Phinite MCP server URL:
   ```
   https://app.phinite.ai/api/v1/ai/mcp
   ```
3. Click **Add**, then **Connect**, and sign in to your Phinite account.

---

## How to use it

Once connected, just talk to Claude — it finds the right agent, runs it, and
brings back the reply:

```
"What agents do I have?"
"Find an agent that can book my appointments"
"Ask the sales agent to qualify this lead: ..."
"Now make that shorter"
```

**Behind the scenes**, the plugin gives Claude three tools (it picks them for you):

- **`discover_agents`** — find the right agent from what you describe.
- **`list_agents`** — see every agent in your workspace.
- **`call_agent`** — Invoke an agent to perform tasks.

**Follow-ups stay in the same thread.** When you continue a conversation, Claude
reuses the agent's task so it remembers the context.

**If an agent needs a tool of its own** (Gmail, Slack, a calendar, etc.), it
replies with a quick **setup link**. Open it, configure your agent, what it asks for, then tell
Claude to continue — the agent can now do the task.

---

*You'll need a Phinite account. Build and publish your agents at [phinite.ai](https://app.phinite.ai/sign-up).*
