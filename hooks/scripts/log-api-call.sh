#!/bin/bash
# Logs every Phinite MCP tool call to ${CLAUDE_PLUGIN_ROOT}/logs/api-calls.log
LOGFILE="${CLAUDE_PLUGIN_ROOT}/logs/api-calls.log"
mkdir -p "$(dirname "$LOGFILE")"
PAYLOAD=$(cat)
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] $PAYLOAD" >> "$LOGFILE"
echo '{"decision":"approve"}'
