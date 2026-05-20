// Disk-persisted per-agent session map: agentId -> { contextId, taskId }.
//
// Cowork respawns the MCP child process between user turns, so any in-memory
// session state vanishes. Persist the whole map to a flat JSON file and reload
// it at startup so multi-turn conversations resume.
//
// Auto-session: the plugin owns conversation continuity per agent — callers
// never thread a contextId.

const fs = require('fs');
const { SESSIONS_FILE, SESSIONS_MAX } = require('./config');

class SessionStore {
  constructor(file = SESSIONS_FILE, max = SESSIONS_MAX) {
    this.file = file;
    this.max  = max;
    this.map  = this._load();
  }

  // The stored session for an agent, or undefined if none.
  get(agentId)  { return this.map.get(agentId); }
  get size()    { return this.map.size; }

  // Record the latest contextId/taskId for an agent.
  // Move-to-end on update so LRU eviction sees recent use as most-recent.
  set(agentId, contextId, taskId) {
    this.map.delete(agentId);
    this.map.set(agentId, { contextId, taskId });
    this._persist();
  }

  // Forget an agent's session so the next call starts fresh.
  clear(agentId) {
    if (this.map.delete(agentId)) this._persist();
  }

  _load() {
    try {
      if (!fs.existsSync(this.file)) return new Map();
      const obj = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      const map = new Map();
      if (obj && typeof obj === 'object') {
        for (const [agentId, value] of Object.entries(obj)) {
          if (value && typeof value === 'object'
              && typeof value.contextId === 'string'
              && typeof value.taskId === 'string') {
            map.set(agentId, { contextId: value.contextId, taskId: value.taskId });
          }
        }
      }
      return map;
    } catch (e) {
      console.error(`[phinite-mcp] could not load sessions: ${e.message}`);
      return new Map();
    }
  }

  _persist() {
    // LRU eviction.
    while (this.map.size > this.max) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    try {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(this.map), null, 2));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      console.error(`[phinite-mcp] could not save sessions: ${e.message}`);
    }
  }
}

module.exports = { SessionStore };
