// Phinite agent registry client.
//
// Talks to the app-dev REST API. Bearer auth is REQUIRED on these endpoints,
// unlike the A2A side which currently has no auth.
//
// Endpoints used:
//   GET /a2a-registry?workspaceid=...&pagination=true&page=N&limit=M[&...]
//   GET /a2a-registry?workspaceid=...&a2aregistryid=<id>
//
// Each row contains:
//   - a2aregistryid  → canonical agent ID (use this everywhere)
//   - agent_card     → the A2A agent card (name, description, skills, ...)
//   - flowid         → the underlying flow ID
//   - status         → "live" | "test"
//   - tools / tool_config → attached tools

const { request } = require('./http-client');
const { APP_BASE_URL, API_KEY, WORKSPACE_ID, A2A_BASE_URL } = require('./config');

class PhiniteRegistryClient {
  constructor({
    baseUrl     = APP_BASE_URL,
    apiKey      = API_KEY,
    workspaceId = WORKSPACE_ID,
    a2aBaseUrl  = A2A_BASE_URL,
  } = {}) {
    this.baseUrl     = baseUrl;
    this.apiKey      = apiKey;
    this.workspaceId = workspaceId;
    this.a2aBaseUrl  = a2aBaseUrl;
  }

  _authHeaders() {
    if (!this.apiKey) {
      throw new Error(
        'PHINITE_API_KEY is required for the registry endpoint. ' +
        'Set it in .mcp.json env.'
      );
    }
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  _requireWorkspace() {
    if (!this.workspaceId) {
      throw new Error(
        'PHINITE_WORKSPACE_ID is required for the registry endpoint. ' +
        'Set it in .mcp.json env (find it in the Phinite dashboard URL).'
      );
    }
  }

  // List agents from the registry. By default returns only live agents.
  // `extra` is merged into the query string (e.g. flowid, name, tag).
  async listAgents({ status = 'live', limit = 50, page = 1, extra = {} } = {}) {
    this._requireWorkspace();

    const params = new URLSearchParams({
      workspaceid: this.workspaceId,
      pagination:  'true',
      page:        String(page),
      limit:       String(limit),
      ...extra,
    });
    if (status) params.set('status', status);

    const resp = await request('GET', `/a2a-registry?${params}`, {
      baseUrl: this.baseUrl,
      headers: this._authHeaders(),
    });

    const rows = Array.isArray(resp.data) ? resp.data : [];
    return rows.map((r) => this._normalize(r));
  }

  // Fetch one row by a2aregistryid. Returns null if not found.
  async getAgent(a2aregistryid) {
    this._requireWorkspace();
    if (!a2aregistryid) throw new Error('agentId (a2aregistryid) is required');

    const params = new URLSearchParams({
      workspaceid:  this.workspaceId,
      a2aregistryid,
      pagination:   'true',
      page:         '1',
      limit:        '1',
    });
    const resp = await request('GET', `/a2a-registry?${params}`, {
      baseUrl: this.baseUrl,
      headers: this._authHeaders(),
    });

    const rows = Array.isArray(resp.data) ? resp.data : [];
    return rows.length ? this._normalize(rows[0]) : null;
  }

  // Normalise a registry row into the shape callers expect.
  // - `id` is the a2aregistryid (canonical agent ID)
  // - `taskUrl` is the JSONRPC endpoint for SendMessage
  // - the rest of the agent_card is preserved
  _normalize(row) {
    const card = row.agent_card || {};
    return {
      id:              row.a2aregistryid,
      a2aregistryid:   row.a2aregistryid,
      flowid:          row.flowid,
      assistantid:     row.assistantid,
      orgid:           row.orgid,
      workspaceid:     row.workspaceid,
      flow_version:    row.flow_version,
      status:          row.status,
      tags:            row.tags || [],
      taskUrl:         `${this.a2aBaseUrl}/a2a/agents/${row.a2aregistryid}`,
      name:            card.name,
      description:     card.description,
      skills:          card.skills || [],
      visibility:      card.visibility,
      auth_schemes:    card.auth_schemes || [],
      defaultInputModes:  card.defaultInputModes || [],
      defaultOutputModes: card.defaultOutputModes || [],
      tools:           row.tools || [],
      tool_config:     row.tool_config || [],
    };
  }
}

module.exports = { PhiniteRegistryClient };
