// phinite_create_flow — turn Claude's flow blueprint into a real Phinite flow.
//
// Claude generates every creative part (nodes, edges, prompts, tool choices,
// custom Python code). This tool is purely mechanical:
//
//   1. For each block, if Claude attached `custom_tools` (code-gen tools),
//      POST /tool to create each, then PUT /tool/{id} with the base64'd code
//      (same shape used by Phinite's copilot — see flow_builder.py).
//   2. Transform the whole blueprint into the platform's nodes/edges/blocks
//      shape via lib/flow-builder.js.
//   3. If `flowId` is provided, PUT /flow_V2/update/{flowId} with the payload.
//   4. Return the transformed payload + any created tool/flow IDs.
//
// The blueprint Claude must produce is documented in skills/phinite-agents/SKILL.md.

const { request, HttpError } = require('../lib/http-client');
const { buildFlowPayload } = require('../lib/flow-builder');
const { APP_BASE_URL, API_KEY, WORKSPACE_ID } = require('../lib/config');

function authHeaders(apiKey) {
  if (!apiKey) {
    throw new Error('PHINITE_API_KEY is required to create flows. Set it in .mcp.json env.');
  }
  return { Authorization: `Bearer ${apiKey}` };
}

// Look up a flow row by flowid. Returns null on 404.
async function fetchFlow({ flowId, apiKey }) {
  try {
    const resp = await request('GET', `/flow_V2?flowid=${encodeURIComponent(flowId)}`, {
      baseUrl: APP_BASE_URL,
      headers: authHeaders(apiKey),
    });
    // Endpoint returns either a flat object or { data: ... } — be permissive.
    if (resp && typeof resp === 'object' && 'flowid' in resp) return resp;
    if (resp?.data) {
      if (Array.isArray(resp.data)) return resp.data[0] || null;
      if (typeof resp.data === 'object') return resp.data;
    }
    return null;
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) return null;
    throw e;
  }
}

// Encode a Python source string to base64 — same as the copilot does before
// PUTting /tool/{id} so the platform stores `is_encoded: true` payloads.
function toBase64(str) {
  return Buffer.from(String(str), 'utf8').toString('base64');
}

// POST /tool to create the tool row, then PUT /tool/{tool_id} with the code.
// Retries on duplicate-name errors by appending a random suffix.
async function createCustomTool({ name, description, code, workspaceId, assistantId, apiKey }) {
  const baseName = name || 'custom_tool';
  let toolName   = baseName;
  let toolId     = null;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const create = await request('POST', '/tool', {
        baseUrl: APP_BASE_URL,
        headers: authHeaders(apiKey),
        body: {
          workspaceid: workspaceId,
          assistantid: assistantId ? [assistantId] : [],
          name:        toolName,
        },
      });
      toolId = create?.toolid || create?.id || create?.data?.toolid;
      if (!toolId) throw new Error('Tool created but no toolid in response: ' + JSON.stringify(create).slice(0, 200));
      break;
    } catch (e) {
      const msg = String(e?.message || '').toLowerCase();
      const isDup = e instanceof HttpError && [400, 409].includes(e.status) &&
                    /duplicate|already exists|name|unique/.test(msg);
      if (!isDup || attempt === maxAttempts - 1) throw e;
      const suffix = Math.random().toString(36).slice(2, 8);
      toolName = `${baseName}_${suffix}`;
    }
  }

  await request('PUT', `/tool/${toolId}`, {
    baseUrl: APP_BASE_URL,
    headers: authHeaders(apiKey),
    body: { description: description || '', api_code: toBase64(code), is_encoded: true },
  });

  return { id: toolId, name: toolName };
}

module.exports = {
  schema: {
    name: 'phinite_create_flow',
    description:
      'Create (or update) a Phinite agent flow. You — Claude — produce the whole ' +
      'creative blueprint: nodes, edges, agent prompts, capture variables, predefined ' +
      'tool references, and any custom-tool code. This tool transforms that blueprint ' +
      'into the exact JSON shape Phinite stores and (optionally) PUTs it to a flow_id. ' +
      'See SKILL.md for the blueprint schema.',
    inputSchema: {
      type: 'object',
      properties: {
        flow: {
          type: 'object',
          description: 'The flow blueprint. See SKILL.md for the full schema.',
          properties: {
            name:        { type: 'string', description: 'Flow display name.' },
            description: { type: 'string', description: 'What the flow does.' },
            nodes: {
              type: 'array',
              description:
                'List of nodes. Always include {id:"start", task:"Start"} and {id:"end", task:"End"}. ' +
                'Each other node: { id, task, type: "task"|"child" }.',
            },
            edges: {
              type: 'array',
              description: 'List of [source, target, label] triples.',
            },
            blocks: {
              type: 'array',
              description:
                'One entry per non-start/end node. Each block: { id, name, agent_prompt, ' +
                'input_variables[], capture_variables{name:desc}, predefined_tools[], custom_tools[], ' +
                'llm_tool_description?, resource?, operation? }.',
            },
          },
          required: ['name', 'description', 'nodes'],
        },
        workspaceId: {
          type: 'string',
          description: 'Phinite workspace ID. Defaults to PHINITE_WORKSPACE_ID env.',
        },
        assistantId: {
          type: 'string',
          description: 'Phinite assistant ID to attach custom tools to. Optional.',
        },
        flowId: {
          type: 'string',
          description:
            'REQUIRED. The empty/draft flow ID the user has provisioned in their ' +
            'Phinite dashboard. You MUST ask the user for this before calling the ' +
            'tool — do not invent one. The tool PUTs the built payload to ' +
            '/flow_V2/update/{flowId}, replacing its current contents.',
        },
      },
      required: ['flow', 'flowId'],
    },
  },

  async handler(args, _ctx) {
    const { flow, flowId } = args || {};
    let workspaceId = args?.workspaceId || WORKSPACE_ID;
    let assistantId = args?.assistantId;
    const apiKey    = API_KEY;

    if (!flow || typeof flow !== 'object') throw new Error('flow is required (object)');
    if (!flowId || !String(flowId).trim()) {
      throw new Error(
        'flowId is required. Ask the user for an empty/draft flow ID from their ' +
        'Phinite dashboard before calling this tool. Do not invent one.'
      );
    }
    if (!workspaceId) {
      throw new Error(
        'workspaceId is required. Pass it as an argument or set PHINITE_WORKSPACE_ID in .mcp.json env.'
      );
    }

    // If we're publishing to an existing flow, custom tools MUST be created
    // under the flow's own assistantid/workspaceid — otherwise the tool exists
    // but the flow can't see it (different assistant scope). Look up the flow
    // and use its values as authoritative.
    const overrides = {};
    if (flowId) {
      const row = await fetchFlow({ flowId, apiKey });
      if (!row) {
        throw new Error(
          `Flow '${flowId}' not found. Pass a valid flowId from the Phinite dashboard, ` +
          'or omit flowId to just return the transformed payload.'
        );
      }
      if (row.assistantid && row.assistantid !== assistantId) {
        overrides.assistantId = { from: assistantId || null, to: row.assistantid };
        assistantId = row.assistantid;
      }
      if (row.workspaceid && row.workspaceid !== workspaceId) {
        overrides.workspaceId = { from: workspaceId, to: row.workspaceid };
        workspaceId = row.workspaceid;
      }
    }

    // 1. Create any custom tools Claude attached and stitch their IDs into the
    //    corresponding blocks before transforming the payload.
    const createdTools = [];
    for (const block of (flow.blocks || [])) {
      const customs = block.custom_tools || [];
      if (!customs.length) continue;
      block.custom_tool_ids = block.custom_tool_ids || [];
      for (const ct of customs) {
        if (!ct?.code) throw new Error(
          `Block '${block.id}' custom_tool '${ct?.name || ''}': "code" is required (Python source as a string)`
        );
        const created = await createCustomTool({
          name:        ct.name,
          description: ct.description,
          code:        ct.code,
          workspaceId,
          assistantId,
          apiKey,
        });
        block.custom_tool_ids.push(created.id);
        createdTools.push({ block: block.id, ...created });
      }
    }

    // 2. Transform blueprint → platform JSON.
    const payload = buildFlowPayload(flow, { workspaceId });

    // 3. Publish.
    let published = null;
    let publishError = null;
    try {
      published = await request('PUT', `/flow_V2/update/${flowId}`, {
        baseUrl: APP_BASE_URL,
        headers: authHeaders(apiKey),
        body:    payload,
      });
    } catch (e) {
      publishError = e instanceof HttpError
        ? { status: e.status, message: e.message }
        : { message: String(e.message || e) };
    }

    return {
      created_tools: createdTools,
      payload,
      flowId,
      published,
      publishError,
      assistantId_used: assistantId || null,
      workspaceId_used: workspaceId,
      overrides_applied: Object.keys(overrides).length ? overrides : null,
      note: published
        ? `Flow ${flowId} updated. ${createdTools.length} custom tool(s) created on assistant ${assistantId || '(none)'}.`
        : `Built the payload but failed to PUT /flow_V2/update/${flowId}.`,
    };
  },
};
