// phinite_discover_agent — fetch the full record for one agent by ID.
//
// Tries the registry first (gives a normalized record with taskUrl and tools).
// Falls back to the well-known agent-card.json on the A2A host if the registry
// is unavailable or unconfigured.

module.exports = {
  schema: {
    name: 'phinite_discover_agent',
    description:
      'Fetch the full record for one Phinite agent by its discovery ID ' +
      '(a2aregistryid). Returns the agent card plus registry metadata: ' +
      'flowid, status, attached tools, and the JSONRPC task URL.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The agent discovery ID (a2aregistryid from phinite_list_agents).',
        },
      },
      required: ['agentId'],
    },
  },

  async handler(args, { registry, a2a }) {
    const { agentId } = args || {};
    if (!agentId) throw new Error('agentId is required');

    if (registry.workspaceId) {
      const row = await registry.getAgent(agentId);
      if (row) return row;
      // Not found in the workspace's registry — try the well-known fallback.
    }
    const card = await a2a.fetchWellKnownCard(agentId);
    return { id: agentId, ...card };
  },
};
