---
name: phinite-agents
description: >
  Use this skill when the user asks to "run a Phinite agent", "invoke an agent",
  "list Phinite agents", "ask Phinite", "use an agent graph", "what agents are
  available", or routes a domain-specific question to a specialized AI agent on
  the Phinite platform. Also use when the user asks to **create**, **build**,
  **design**, or **publish** a new flow / agent / agent graph — call
  `phinite_create_flow` with a blueprint you generate.
metadata:
  version: "0.4.0"
---

## Using Phinite Agent Graphs

### Discover available agents

Call `phinite_list_agents` (no arguments) to get every agent in the configured
Phinite workspace. Each entry has:

- `id` — the discovery ID (a2aregistryid) used to invoke the agent
- `name` — human-readable name
- `description` — what the agent does
- `flowid` — the underlying flow ID
- `status` — usually `"live"`
- `skills`, `tools`, `tool_config` — capabilities and attached tools

For a single agent's full record (including `taskUrl`), call
`phinite_discover_agent` with that `id`.

### Invoke an agent

Call `phinite_invoke_agent` with:

- `agentId` — the `id` from `phinite_list_agents`
- `message` — the user's input as plain text
- `sessionId` (optional) — pass the `contextId` from the previous response to
  continue the same conversation

The response includes:

- `taskId`, `contextId`, `status` (e.g. `TASK_STATE_INPUT_REQUIRED`)
- `answer` — the agent's reply text
- `_debug` — diagnostic info (server version, session map state)

`TASK_STATE_INPUT_REQUIRED` means *the conversation is open*, not that the
agent is stuck. Real terminal states are `TASK_STATE_COMPLETED` and
`TASK_STATE_FAILED`.

### Routing rules

- For domain-specific questions that match an agent's description, route
  directly to that agent without asking.
- If it's unclear which agent fits, call `phinite_list_agents`, pick the best
  match, then invoke it.
- Relay the agent's answer faithfully. Don't summarise or rewrite unless asked.
- Never answer from your own knowledge questions that fall within a Phinite
  agent's domain.

---

## Creating a new flow

When the user asks you to create / build / design / publish a flow or agent on
Phinite, you produce the **whole creative blueprint** and pass it to
`phinite_create_flow`. The tool transforms your blueprint into the platform's
storage shape (node positions, capture-variable IDs, orchestration-model
defaults, predefined-tool entries) and — if a `flowId` is provided — publishes
it.

You generate; the tool packages.

### Blueprint schema (what you pass as `flow`)

```jsonc
{
  "name":        "Customer Intake Flow",
  "description": "Triages incoming customer inquiries and routes to the right team.",
  "nodes": [
    { "id": "start", "task": "Start" },
    { "id": "intake-agent",     "task": "Process customer inquiry",          "type": "task" },
    { "id": "child-sentiment",  "task": "Analyse sentiment and urgency",     "type": "child" },
    { "id": "fulfilment-agent", "task": "Coordinate fulfilment integrations","type": "task" },
    { "id": "end", "task": "End" }
  ],
  "edges": [
    ["start",         "intake-agent",     "new_inquiry_received"],
    ["intake-agent",  "child-sentiment",  "sentiment_analysis"],
    ["intake-agent",  "fulfilment-agent", "requirements_extracted"],
    ["fulfilment-agent", "end",           "request_completed"],
    ["intake-agent",  "end",              "invalid_request"]
  ],
  "blocks": [
    {
      "id": "intake-agent",
      "name": "Customer Intake Agent",
      "agent_prompt": "<long, detailed prompt — see rules below>",
      "input_variables": ["raw_message"],
      "capture_variables": {
        "customer_email": "The customer's email address. Validate format.",
        "service_type":   "One of: billing, technical, sales, other."
      },
      "predefined_tools": [
        {
          "name": "firecrawl",
          "operation": "scrape",
          "description": "Scrape a referenced URL for context",
          "icon_url": "https://...",
          "inputs":  { "firecrawl.scrape.url": { "type": "string", "description": "URL to scrape" } },
          "outputs": ["firecrawl.scrape.output.html"]
        }
      ],
      "custom_tools": [
        {
          "name": "log_inquiry",
          "description": "Persist the customer inquiry to our CRM.",
          "code": "def main(inputs, env_variables):\n    import requests\n    ...\n    return {'output': {...}, 'capture_variables': {...}}"
        }
      ]
    },
    {
      "id": "child-sentiment",
      "name": "Sentiment Analyzer",
      "agent_prompt": "<child agent prompt>",
      "input_variables": ["raw_message"],
      "capture_variables": {
        "sentiment_score": "Float -1.0 to 1.0",
        "urgency_rating":  "Integer 1-5"
      },
      "llm_tool_description": "Analyses customer message sentiment and urgency.",
      "resource":  "text",
      "operation": "analysis"
    }
  ]
}
```

### Rules

**Nodes**
- Always include `start` and `end`.
- Master agents: `type: "task"`. Child agents: `type: "child"`.
- Descriptive kebab-case IDs (`customer-intake-agent`, `child-sentiment-analyzer`).
- Don't connect `start` to two different nodes — route through one master.

**Edges**
- Tuples `[source, target, label]`. Every master agent must have at least one incoming and one outgoing edge.
- Child agent edges go FROM the parent master TO the child: `["master-id", "child-id", "label"]`. The master is the caller; the child is the callee. Never list the child as source.
- No orphans.

**Blocks**
- One block per non-start/end node.
- `agent_prompt`: detailed, actionable, well-formatted markdown. Minimum 300 chars for master agents, 200 for child agents.
- `capture_variables`: a `{name: description}` mapping. Descriptions guide LLM extraction.
- `input_variables`: string array of names that must exist in upstream capture_variables or tool outputs.
- `predefined_tools`: tools from the Phinite catalogue (firecrawl, google_calendar, etc.). Don't make up names — only attach tools that you know exist or that the user has told you about.
- `custom_tools`: code-gen tools. You write the Python source as a string; the tool will base64-encode and POST it. Function signature: `def main(inputs, env_variables):` returning `{"output": ..., "capture_variables": ...}`.

**Child agents only** — must specify:
- `llm_tool_description` — what this child does (master uses it to decide when to delegate)
- `resource` — one of `text|image|video|audio|document`
- `operation` — one of `analysis|generation`

### Calling the tool

```jsonc
{
  "flow":        { ...blueprint... },
  "flowId":      "<existing empty flow id>",  // REQUIRED — see workflow step 1
  "workspaceId": "aTIVxzm",      // optional — defaults to PHINITE_WORKSPACE_ID
  "assistantId": "i3OsD7o"       // optional — only needed if attaching custom_tools
}
```

### Workflow — flowId is required

You MUST have a `flowId` before calling `phinite_create_flow`. The tool will
hard-error otherwise. The flow ID is an empty/draft flow row provisioned by
the user in their Phinite dashboard.

1. **Ask the user for the flow ID first.** Before doing any blueprint design,
   ask something like: *"To create this flow on Phinite I need an empty
   flow ID. Please go to your Phinite dashboard, create an empty/draft flow,
   and paste its flow ID here."*
   - Do NOT invent a flow ID. Do NOT proceed without one.
   - If the user says they don't have one, explain that they must create an
     empty flow in the Phinite dashboard first — the tool only updates
     existing flow rows, it cannot create them from scratch.
2. Ask the user what the flow should do (1-2 short questions, not a survey).
3. Draft the blueprint following the rules above.
4. Show the user a short summary (nodes, blocks, tools) before calling the
   tool — let them OK it for non-trivial designs.
5. Call `phinite_create_flow` with `flow` + `flowId`.
6. Report `created_tools`, `flowId`, and any `publishError` back to the user.
   If `publishError` is present, show its message and let them retry / fix.

### Error handling

- "PHINITE_API_KEY is required" → user must set it in the plugin settings.
- "PHINITE_WORKSPACE_ID is required" → user must set it in the plugin settings.
- A2A errors → relay the code and message verbatim.
