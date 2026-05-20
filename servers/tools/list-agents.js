// phinite_list_agents — list every agent visible to the configured workspace.
//
// Uses the real registry endpoint when PHINITE_WORKSPACE_ID is set.
// Falls back to PHINITE_AGENT_IDS (well-known agent-card lookups) if it's not,
// so offline tests against a known agent still work.

const { FALLBACK_AGENT_IDS } = require('../lib/config');

module.exports = {
  schema: {
    name: 'phinite_list_agents',
    description:
      'List every Phinite agent the configured workspace has access to. ' +
      'By default returns only agents with status="live". ' +
      'Each entry has: id (a2aregistryid), name, description, skills, flowid, status. ' +
      'Pass these IDs to phinite_invoke_agent.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['live', 'test', 'all'],
          description: 'Filter by registry status. Default "live". "all" disables the filter.',
        },
        limit: {
          type: 'number',
          description: 'Max rows to return (default 50, max 100 server-side).',
        },
      },
      required: [],
    },
  },

  async handler(args, { registry, a2a }) {
    const limit  = Math.min(args?.limit || 50, 100);
    const status = args?.status === 'all' ? null : (args?.status || 'live');

    // Workspace configured → registry path.
    if (registry.workspaceId) {
      return await registry.listAgents({ status, limit });
    }

    // No workspace → fall back to well-known card lookups on the A2A host.
    // Useful only for testing against a hardcoded set of discovery IDs.
    if (!FALLBACK_AGENT_IDS.length) {
      throw new Error(
        'No agents to list: set PHINITE_WORKSPACE_ID (preferred) or PHINITE_AGENT_IDS in .mcp.json env.'
      );
    }
    const results = await Promise.allSettled(
      FALLBACK_AGENT_IDS.map(async (id) => {
        const card = await a2a.fetchWellKnownCard(id);
        return { id, ...card };
      }),
    );
    return results.map((r, i) =>
      r.status === 'fulfilled' ? r.value : { id: FALLBACK_AGENT_IDS[i], error: r.reason?.message || String(r.reason) }
    );
  },
};
