// phinite_invoke_agent — send a message to an agent via A2A SendMessage.
//
// Session: PhiniteA2AClient owns conversation continuity per agent via the
// SessionStore. The caller picks `conversationMode` ("new" | "continue") each
// call; "continue" reuses the agent's stored context, "new" starts fresh.

module.exports = {
  schema: {
    name: 'phinite_invoke_agent',
    description:
      "Send a message to a Phinite agent and return its reply. " +
      "You MUST set `conversationMode`: 'new' to start a fresh conversation, " +
      "or 'continue' to follow up on this agent's previous call. Continuity " +
      "is handled automatically — you never pass a session identifier. " +
      "The result's `continued` field shows whether an existing conversation " +
      "was continued.",
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The agent discovery ID (a2aregistryid from phinite_list_agents).',
        },
        message: {
          type: 'string',
          description: "The user's question or task input as plain text.",
        },
        conversationMode: {
          type: 'string',
          enum: ['new', 'continue'],
          description:
            "Required. Use 'new' when this request is about a different " +
            "subject than the previous call to this agent (a different post, " +
            "document, or question). Use 'continue' when it is a follow-up to " +
            "this agent's previous call (e.g. 'make it shorter', 'now revise it').",
        },
      },
      required: ['agentId', 'message', 'conversationMode'],
    },
  },

  async handler(args, { a2a }) {
    const { agentId, message, conversationMode } = args || {};
    if (!agentId) throw new Error('agentId is required');
    if (!message) throw new Error('message is required');
    if (conversationMode !== 'new' && conversationMode !== 'continue') {
      throw new Error("conversationMode is required and must be 'new' or 'continue'");
    }
    return await a2a.sendMessage(agentId, message, { conversationMode });
  },
};
