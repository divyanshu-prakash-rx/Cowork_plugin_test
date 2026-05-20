// Phinite A2A (Agent-to-Agent) JSON-RPC client.
//
// Talks to the ai-core-dev endpoint via the JSON-RPC method "SendMessage".
// Session continuity requires sending BOTH contextId AND prior taskId inside
// the message — the SessionStore tracks each agent's contextId + taskId, so
// continuity is automatic and callers never thread a session id.
//
// Auth note: the A2A endpoint authenticates via the X-Api-Key header,
// carrying the same PHINITE_API_KEY used for the registry endpoint (which
// instead uses Authorization: Bearer).

const crypto = require('crypto');
const { request } = require('./http-client');
const { A2A_BASE_URL, API_KEY, SERVER_VERSION } = require('./config');

class PhiniteA2AClient {
  constructor({
    baseUrl       = A2A_BASE_URL,
    apiKey        = API_KEY,
    sessionStore,                       // injected (required)
    registryClient,                     // injected (required)
  } = {}) {
    if (!sessionStore)   throw new Error('a2a-client: sessionStore is required');
    if (!registryClient) throw new Error('a2a-client: registryClient is required');
    this.baseUrl       = baseUrl;
    this.apiKey        = apiKey;
    this.sessions      = sessionStore;
    this.registry      = registryClient;
    this._taskUrlCache = new Map();   // agentId → task URL (per-process)
  }

  // Build auth headers for the A2A endpoint.
  //
  // The A2A side authenticates via the X-Api-Key header (the registry side
  // uses Authorization: Bearer instead). The same PHINITE_API_KEY value works
  // for both.
  _authHeaders() {
    const headers = {};
    if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }
    return headers;
  }

  // Resolve the JSON-RPC task URL for an agent.
  //
  // The task URL is deterministic — <a2aBaseUrl>/a2a/agents/<agentId> — so we
  // build it directly. The registry's single-agent lookup returns this exact
  // same URL and is currently unreliable, so invoke no longer depends on it.
  async resolveTaskUrl(agentId) {
    if (this._taskUrlCache.has(agentId)) return this._taskUrlCache.get(agentId);
    const url = `${this.baseUrl}/a2a/agents/${encodeURIComponent(agentId)}`;
    this._taskUrlCache.set(agentId, url);
    return url;
  }

  // GET <a2a>/a2a/<id>/.well-known/agent-card.json
  async fetchWellKnownCard(agentId) {
    return await request('GET', `/a2a/${encodeURIComponent(agentId)}/.well-known/agent-card.json`, {
      baseUrl: this.baseUrl,
      headers: this._authHeaders(),
    });
  }

  // POST <taskUrl> with method=SendMessage.
  //
  // Session: when conversationMode is "continue", the stored contextId + prior
  // taskId for this agent are placed INSIDE `message` — the platform requires
  // both to load conversation history. "new" starts a fresh thread. Either
  // way the response's contextId/taskId are stored back for the next call.
  async sendMessage(agentId, text, opts = {}) {
    const taskUrl = await this.resolveTaskUrl(agentId);

    const message = { role: 'user', parts: [{ type: 'text', text }] };

    const continueRequested = opts.conversationMode === 'continue';
    let continued = false;
    let prior = null;
    if (continueRequested) {
      prior = this.sessions.get(agentId) || null;
      if (prior?.contextId) {
        message.contextId = prior.contextId;
        if (prior.taskId) message.taskId = prior.taskId;
        continued = true;
      }
    }

    const payload = {
      jsonrpc: '2.0',
      id:      crypto.randomUUID(),
      method:  'SendMessage',
      params:  { message },
    };

    const resp = await request('POST', taskUrl, {
      body:    payload,
      headers: this._authHeaders(),
    });

    if (resp.error) {
      throw new Error(`A2A error ${resp.error.code}: ${resp.error.message}`);
    }

    const task = resp.result?.task || {};
    if (task.contextId && task.id) {
      this.sessions.set(agentId, task.contextId, task.id);
    }

    return {
      taskId:    task.id,
      contextId: task.contextId,
      status:    task.status?.state || 'UNKNOWN',
      answer:    this._extractAnswer(task.artifacts),
      artifacts: task.artifacts || [],
      continued,
      _debug: {
        serverVersion:  SERVER_VERSION,
        agentId,
        continued,
        priorContextId: prior?.contextId || null,
        priorTaskId:    prior?.taskId || null,
        mapSize:        this.sessions.size,
      },
    };
  }

  // Flatten every text-bearing part across every artifact into one string.
  _extractAnswer(artifacts) {
    if (!Array.isArray(artifacts)) return 'No answer returned';
    const chunks = [];
    for (const a of artifacts) {
      for (const p of (a.parts || [])) {
        if (typeof p.text === 'string' && p.text) chunks.push(p.text);
      }
    }
    return chunks.join('\n\n') || 'No answer returned';
  }
}

module.exports = { PhiniteA2AClient };
